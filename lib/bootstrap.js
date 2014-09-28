/*
 * Functionality required on startup
 */

var content = require('./content')
  , user = require('./user')
  , system = require('./system')
  , utility = require('./utility')
  , mysql = require('mysql')
  , async = require('async')
  , fs = require('fs')
  , _ = require('underscore')
  , crypto = require('crypto')
  , child_process = require('child_process')
  ;

var handyDirectory = utility.findHandyDirectory();

/*
 * initialization sequence for starting up the app.
 * Connects to database, makes sure all the tables are in place
 * reads site configuration into memory
 *
 * @api public
 */
exports.initialize = initialize;

function initialize(callback){ 
  console.log('initializing.  please wait...');
  // assume installation is required.
  system.systemVariable.set('installation_flag', false);
  _updateConfigWithDefaults(); // set configuration defaults
  
  var asyncFn = [
    _readConfigurationFile,
    _createDatabasePool,
    _createDatabaseTables,
    _createDatabaseMiscTables,
    _loadConfigurationFromDatabaseToMemory,
    _initializeContentAndObjectConstructors,
    _initializePermissionGrants,
    _initializeCronTasks.bind(null, _defaultConfig('cronDefault')),
    _initializeSystemLogging
  ];
  
  async.waterfall(asyncFn, function(err, results){
    if(err){return callback(err);}
    // initialization complete
    system.systemVariable.set('installation_flag', true); // installation verified
    system.systemVariable.set('testFlag', true); // lets the test system know the app is initialized and ready
    return callback(null);
  });
}

// read config.js file
function _readConfigurationFile(callback){
  // open config.js
  fs.open(handyDirectory + '/config/handy-config.js', 'r', function(err, fd){
    // if config.js cannot be opened, assume installation required
    if(err){return callback(err);}
    
    var config = require(handyDirectory + '/config/handy-config');
    fs.close(fd, function(err){
      if(err){console.log('\n...error closing handy-config.js after reading');}
      return callback(null, config);
    });
  });
}

// create database pool
function _createDatabasePool(config, callback){
  // define database connection options
  var connectionOptions = {
    host: config.configObj.host,
    user: config.configObj.dbUser,
    password: config.configObj.dbPassword,
    database: config.configObj.dbName,
    connectionLimit: 100
  };
  
  var pool = mysql.createPool(connectionOptions);
  system.systemVariable.set('pool', pool);
  system.systemVariable.set('database', connectionOptions.database);
  system.systemVariable.set('databaseUser', connectionOptions.user);
  system.systemVariable.set('databasePassword', connectionOptions.password);
  return callback(null, pool);
}

// create database tables
function _createDatabaseTables(pool, callback){
  // list of initial types of objects is provided in the default config object under initialObjectList (see function _updateConfigWithDefaults)
  var objectList = [];
  var initialObjectList = system.systemVariable.getConfig('initialObjectList');
  var contentTypeList = system.systemVariable.getConfig('contentTypeList');
  
  // add constructors from initialObjectList
  _.forEach(initialObjectList, function(construct){
    objectList.push(construct);
  });
  
  // add constructors from contentTypeList
  _.forEach(contentTypeList, function(construct){
    objectList.push(construct);
  });
  
  
  // set up function to create tables
  var seriesFunctions = [];
  objectList.forEach(function(val){
    seriesFunctions.push(
      function(clbck){
        var temp = new val();
        temp.createTable(function(err, results){
          temp = null;  // free up memory
          clbck(err, results);
        });
      }
    );
  });
  
  async.series(seriesFunctions,
    function(err, results){
      return callback(err, pool);
    }
  );
}


/*
 * create other database tables
 */
function _createDatabaseMiscTables(pool, callback){
  // create siteconfig table.  stores all site configuration
  var query = 'CREATE TABLE IF NOT EXISTS siteconfig (';
  query += 'id INT(10) NOT NULL AUTO_INCREMENT, ';
  query += 'config VARCHAR(32767) NULL, ';
  query += 'PRIMARY KEY (id)';
  query += ')';
  
  pool.getConnection(function(err, connection){
    if(err){return callback(err);}
    connection.query(query, function(err, results){
      connection.release();
      if(err){return callback(err);}
      return callback(null, pool);
    });
  });
}

// load configuration from database to memory
function _loadConfigurationFromDatabaseToMemory(pool, callback){
  var query = 'SELECT config FROM siteconfig LIMIT 1';
  pool.getConnection(function(err, connection){
    if(err){return callback(err);}
    connection.query(query, function(err, results){
      connection.release();
      var configuration;
      if(err || results.length === 0){
          return callback(new Error('bootstrap/_lcfdtm: error loading configuration from database'));
      }
      configuration = JSON.parse(results[0].config);
      system.systemVariable.updateConfig(configuration, function(error){
        return callback(null);
      });
    });
  });
}

/*
 * initialize native content and object types
 * This function is necessary because constructor functions cannot be saved to the database.
 * Hence, it is necessary to reload the constructor functions each time Handy restarts.
 * NOTE: This must run AFTER the configuration is loaded from disk otherwise, all this gets overwritten
 */
function _initializeContentAndObjectConstructors(callback){
  var update = {
    initialObjectList: {
      user: user.User,
      contentList: content.ContentList
    },
    contentTypeList: {
      Category: content.Category,
      Story: content.Story,
      Comment: content.Comment
    }    
  };
  
  system.systemVariable.updateConfig(update, function(err){
    return callback(err);
  });
}
 

/* intialize granting of permissions to various roles
 * NOTE: During the initialization sequence, this function needs to run after 
 * the function _loadConfigurationFromDatabaseToMemory, otherwise any post-installation updates to the configuration will be missed
 */

function _initializePermissionGrants(callback){
  user.initializePermissionGrants(function(err){
    callback(err);
  });
}


/*
 * Set the tasks to be run under cron
 * NOTE: This function updates the systemVariable property 'cronTask'.  This is NOT persisted to the database
 * and must be initialized each time the app starts.  Also, there is a config property 'cronRecord' which maintains
 * the frequency and last time each cron task was run.  This information is, however, persisted to database (obviously)
 * Clearly, both cronTask and cronRecord need to be kept in sync.  This is done by using ONLY the addCronTask and 
 * deleteCronTask functions to create, modify and remove any cron task
 */
function _initializeCronTasks(defaultCronSettings, callback){
  // get current cron settings and do not override them if they exist
  var currentCronRecord = system.systemVariable.getConfig('cronRecord');  // this contains task names, frequency and last time run (stored to db)
  var currentCronTask = system.systemVariable.get('cronTask') || {};  // this contains the task names and functions (not stored to db)
  
  defaultCronSettings.forEach(function(cronSet){
    var freq, lastrun;
    // check if this record already exists in currentCronRecord, if not, update with default values
    if(!currentCronRecord.task[cronSet.taskName]){
      currentCronRecord.task[cronSet.taskName] = {};
      currentCronRecord.task[cronSet.taskName].freq = cronSet.description.freq;
      currentCronRecord.task[cronSet.taskName].lastrun = cronSet.description.lastrun;
    }
    
    // update currentCronTask
    currentCronTask[cronSet.taskName] = cronSet.description.run;
    system.systemVariable.set('cronTask', currentCronTask);
  });
  
  // update config
  system.systemVariable.updateConfig({cronRecord: currentCronRecord}, function(err){
    if(err){callback(err);}
    
    /* PROBLEM: This should not be necessary*/
    // add backup and log reporter to the cron
    var asyncFn = [];  // will contain async functions

    // add backup to cron
    var freq = system.systemVariable.getConfig('backupFreq');
    var destination = system.systemVariable.getConfig('backupDestination');
    var destType = system.systemVariable.getConfig('backupDestinationType');
    if (freq && destination && destType){
      asyncFn.push(
        function(asyncCallback){
          freq = parseInt(freq) * 60;
          system.addCronTask('handy scheduled backup', system.backupDatabase, freq, function(err){
            asyncCallback(err);
          });
        }
      );
    }

    // add log reporting to cron
    var reportFreq = system.systemVariable.getConfig('reportFreq');
    var reportDestination = system.systemVariable.getConfig('reportDestination');
    if(reportFreq && reportDestination){
      asyncFn.push(
        function(asyncCallback){
          reportFreq = parseInt(reportFreq) * 60;
          system.addCronTask('handy scheduled activity report', system.logger.report, reportFreq, function(err){
            asyncCallback(err);
          });
        }
      );
    }

    async.parallel(asyncFn, function(err){
      callback(err);
    });
  });
}

/*
 * initialize logging system
 */
function _initializeSystemLogging(callback){
  system.logger.start();
  callback();
}


/* 
 * update config in memory with defaults
 * used to set default config properties before installation is run
 */
function _updateConfigWithDefaults(){
  var defaultConfig = {
    defaultFrontPage: '',
    default404Page: '',
    default403Page: '',
    welcomePage: '',
    siteEmailPassword: '',
    emailAgent: 'mail_server',
    mandrillApiKey: '',
    siteEmailHost: '',
    siteEmailPort: '',
    siteEmailSSL: false,
    siteEmailTLS: true,
    siteEmailTimeout: '',
    googleAnalyticsId: '',
    backupFreq: 24,
    backupDestinationType: 'email',
    backupDestination: '',
    reportFreq: 24,
    reportDestination: '',
    anonUser: 'anonymous',
    deletedUser: 'deleted',
    registerAuthority: 'visitor',
    emailVerify: true,
    welcome_new_user_admin_subject: 'Welcome to [site:name]',
    welcome_new_user_admin_body: 'Hi,\n\nYour account on [site:name] is ready.\n\n[site:name] does all these cool stuff.\n\nYou may now log in by clicking this link or copying and pasting it into your browser.\n\n[user:one-time-login-url]\n\nThis link can only be used once and expires in 24 hours.  Clicking this link will lead you to a page where you can set your password.\n\nAfter setting your password, you will be able to log in at [site:url] in the future using:\n\nemail: [user:email]\npassword: Your password\n\nThank you and hope you enjoy using [site:name].\n\n[site:name] team',
    welcome_new_user_approval_required_subject: 'Account details for [user:name] at [site:name] (pending admin approval)',
    welcome_new_user_approval_required_body: '[user:name],\n\nThank you for registering at [site:name]. Your application for an account is currently pending approval. Once it has been approved, you will receive another e-mail containing information about how to log in, set your password, and other details.\n\n--  [site:name] team',
    welcome_new_user_no_approval_required_subject: 'Welcome to  [site:name]',
    welcome_new_user_no_approval_required_body: 'Hi,\n\nThanks for checking out [site:name].\n\n[site:name] does all these cool stuff.\n\n\n\nThank you and hope you enjoy using [site:name].\n\n[site:name] team',
    welcome_new_user_email_verification_required_subject: 'Welcome to [site:name]',
    welcome_new_user_email_verification_required_body: 'Hi,\n\nThanks for checking out [site:name].\n\n[site:name] does all these cool stuff.\n\nPlease verify your email address by clicking this link or copying and pasting it into your browser.\n\n[user:one-time-email-verification-url]\n\nThank you and hope you enjoy using [site:name].\n\n[site:name] team',
    account_activation_checkbox: true,
    account_activation_subject: 'Account details for [user:name] at [site:name] (approved)',
    account_activation_body: '[user:name],\n\nYour account at [site:name] has been activated.\n\nYou may now log in by clicking this link or copying and pasting it into your browser:\n\n[user:one-time-login-url]\n\nThis link can only be used once to log in and will lead you to a page where you can set your password.\n\nAfter setting your password, you will be able to log in at [site:login-url] in the future using:\n\nemail: [user:email]\npassword: Your password\n\n--  [site:name] team',
    account_blocked_checkbox: false,
    account_blocked_subject: 'Account details for [user:name] at [site:name] (blocked)',
    account_blocked_body: '[user:name],\n\nYour account on [site:name] has been blocked.\n\n--  [site:name] team',
    account_cancel_request_subject: 'Account cancellation request for [user:name] at [site:name]',
    account_cancel_request_body: '[user:name],\n\nA request to cancel your account has been made at [site:name].\n\nYou may now cancel your account on [site:url-brief] by clicking this link or copying and pasting it into your browser:\n\n[user:cancel-url]\n\nNOTE: The cancellation of your account may not be reversible.\n\nThis link expires in one day and nothing will happen if it is not used.\n\n--  [site:name] team',
    account_cancelled_checkbox: false,
    account_cancelled_subject: 'Account details for [user:name] at [site:name] (cancelled)',
    account_cancelled_body: '[user:name],\n\nYour account on [site:name] has been cancelled.\n\n--  [site:name] team',
    password_recovery_subject: 'Replacement login information for [user:name] at [site:name]',
    password_recovery_body: '[user:name],\n\nA request to reset the password for your account has been made at [site:name].\n\nYou may now log in by clicking this link or copying and pasting it to your browser:\n\n[user:one-time-login-url]\n\nThis link can only be used once to log in and will lead you to a page where you can set your password. It expires after one day and nothing will happen if it\'s not used.\n\n--  [site:name] team',
    email_verification_resend_subject: 'Please verify your email for [site:name]',
    email_verification_resend_body: '[user:name],\n\nAn email verification request has been made for your account at [site:name].\n\nPlease verify your email address by clicking this link or copying and pasting into your browsser:\n\n[user:one-time-email-verification-url]\n\nThank you.\n\n[site:name] team',
    initialObjectList: {
      user: user.User,
      contentList: content.ContentList
    },
    contentTypeList: {
      Category: content.Category,
      Story: content.Story,
      Comment: content.Comment
    },
    resourcePermissionList: {
      system: {
        System: ['Can run tests', 'Can alter system configuration']
      },
      user:{
        "*": ["Can modify own account", "Can modify other users' accounts", "Can create new roles", "Can modify roles", "Can grant roles"],
        User: []
      },
      content:{
        "*": ["Can view content", "Can create draft content", "Can create new content", "Can modify own content only", "Can modify any content", "Can delete own content only", "Can delete any content"],
        Story: [],
        Comment: [],
        Category: []
      }
    },
    rolesPermissionGrant: {
      administrator: {'all': ['all']},
      unauthenticated: {
        "content.Story": ['Can view content'],
        "content.Comment": ['Can view content']
      },
      authenticated: {
        "user.User": ['Can modify own account'],
        "content.Story": ["Can view content", "Can create draft content"],
        "content.Comment": ["Can view content", "Can create draft content"]
      },
      verified: {
        "user.User": ['Can modify own account'],
        "content.Story": ["Can view content", "Can create new content", "Can create draft content", 'Can modify own content only', 'Can delete own content only'],
        "content.Comment": ["Can view content", "Can create new content", "Can create draft content", 'Can modify own content only', 'Can delete own content only']
      },
      editor:{
        "user.User": ['Can modify own account'],
        "content.Story": ["Can view content", "Can create new content", "Can create draft content", "Can modify own content only", "Can modify any content", "Can delete own content only", "Can delete any content"],
        "content.Comment": ["Can view content", "Can create new content", "Can create draft content", "Can modify own content only", "Can modify any content", "Can delete own content only", "Can delete any content"],
        "content.Category": ["Can view content", "Can create new content", "Can create draft content", "Can modify own content only", "Can modify any content", "Can delete own content only", "Can delete any content"]
      }
    },
    sitemapSubmit: false,
    sitemapConfig:{
      content: {
        Story: {freq: 'hourly', priority: '0.8'},
        Comment: {freq: 'daily', priority: '0.2'},
        Category: {}
      },
      default: {
        freq: 'weekly',
        priority: '0.5'
      }

    },
    categoryList: {},
    alias: {},
    cronRecord: {
      path:'',
      task: {}
    },
    theme: {
      head: _defaultConfig('theme_head'),
      section_header: _defaultConfig('theme_section_header'),
      section_messages: _defaultConfig('theme_messages'),
      section_footer: _defaultConfig('theme_section_footer'),
      section_bottomscripts: _defaultConfig('theme_section_bottomscripts'),
      section_extras: _defaultConfig('theme_section_extras'),
    },
    themeTemplateDefault: {
      head: _defaultConfig('theme_head'),
      section_header: _defaultConfig('theme_section_header'),
      section_messages: _defaultConfig('theme_messages'),
      section_footer: _defaultConfig('theme_section_footer'),
      section_bottomscripts: _defaultConfig('theme_section_bottomscripts'),
      section_extras: _defaultConfig('theme_section_extras'),
    }
  };
  
  _.forEach(defaultConfig, function(val, key){
    system.systemVariable['config'][key] = val;
  });
  
  return;
}


/*
 * installation procedure
 *
 * @param {obj} req - request object
 * @param {obj} res - response object
 * @param {obj} next - next function
 * @api public
 */
exports.runInstallation = runInstallation;

function runInstallation(req, res, callback){ 
  // set different pool properties depending on the environment
  var host, user, password, name;
  switch (process.env.NODE_ENV){
    case 'production':
      host = 'localhost';
      user = req.body.dbUser;
      password = req.body.dbPassword;
      name = req.body.dbName;
      break;
    case 'development':
      host = 'localhost';
      user = 'devuser';
      password = 'devpassword';
      name = 'devdb';
      break;
    case 'test':
      host = 'localhost';
      user = 'testuser';
      password = 'testpassword';
      name = 'testdb';
      break;
  }
  
  var config = {
    configObj: 
    {
      host: host,
      dbUser: user,
      dbPassword: password,
      dbName: name 
    }
  };
  
  // special database variables for development and test environments
  var environments = {
    development: {
      host: 'localhost',
      dbUser: 'devuser',
      dbPassword: 'devpassword',
      dbName: 'devdb'
    },
    test: {
      host: 'localhost',
      dbUser: 'testuser',
      dbPassword: 'testpassword',
      dbName: 'testdb'
    }
  };
  
  _createDatabasePool(config, function(){});
  
  var pool = system.systemVariable.get('pool');
  var asyncFn = [
    _createDatabaseTables.bind(null, pool),
    _createDatabaseMiscTables.bind(null, pool),
    _createCronPath.bind(null),
    _saveSiteConfiguration.bind(null, req),
    _initializePermissionGrants,
    _initializeCronTasks.bind(null, _defaultConfig('cronDefault')),
    _initializeSystemLogging,
    _createAndLoginAdminUser.bind(null, req),
    _createConfigFile.bind(null, environments, req)
  ];
  
  async.series(asyncFn, function(err, results){
    if(err){return callback(err);}
    // set system flag to indicate installation is complete
    system.systemVariable.set('installation_flag', true);
    console.log('installation complete...');
    var initialFunction = system.systemVariable.get('initialFunction') || function(){};
    initialFunction();  // start project execution
    // wait for initialFunction to run before finishing up
    setTimeout(function(){
      return callback(null);
    }, 5000);
  });
}

// create an obscure path for calling cron in order to provide a little extra security
function _createCronPath(asyncCallback){
  var len = 32;
  crypto.randomBytes(len, function(err, cronPath){
    if(err){return asyncCallback(err);}
    cronPath = cronPath.toString('base64');  // convert from buffer to text
    // remove any percent signs as a precaution to ensure decoding the path does not create any weird effects
    // e.g. inserting new paths or parameters into the cron path
    cronPath = encodeURIComponent(cronPath).replace(/%/g, 'p');
  
    // get current cron setting
    var cronRecord = system.systemVariable.getConfig('cronRecord');
    cronRecord.path = cronPath;
  
    // save cron setting
    system.systemVariable.updateConfig({cronRecord: cronRecord}, function(err){
      return asyncCallback(err);
    });
  });    
}


// save site configuration to database
function _saveSiteConfiguration(req, callback){
  // set site configuration information
  var updateConfig = {
    siteName: req.body.siteName,
    siteEmail: req.body.siteEmail
  };
  
  system.systemVariable.updateConfig(updateConfig, function(err){
    if(err){return callback(err);}
    return callback(null);
  });
}

// create and login admin user
function _createAndLoginAdminUser(req, callback){
  // create admin user
  var admin = new user.User();
  admin.name = req.body.adminName;
  admin.email = req.body.adminEmail;
  admin.authenticated = true;
  admin.verified = true;
  admin.creator = 1;
  admin.hash(req.body.adminPassword, function(err, salt, hash){
    if(err){return callback(err); }
    
    admin.lastlogin = new Date();
    admin.save(function(err){
      if(err){return callback(err); }
    
      // login admin user
      admin.id = 1;
      admin.login(req, function(err){
        if(err){return callback(err); }
              
        // assign administrator role to admin user
        admin.assignRole(['administrator', 'verified'], function(err){
          if(err){return callback(err); }
          admin = null; // free up memory
          return callback(null);
        });
      });
    });
  });
}


// create config.js file with basic config details
function _createConfigFile(environments, req, callback){
  // compose config file contents
  var configScript = '/*\n * Configuration script for the site\n*/ ';
  configScript += '\n\n var config = {\n';
  configScript += '\t// Site information\n';
  configScript += '\tsiteName: "' + req.body.siteName + '",\n';
  configScript += '\tsiteEmail: "' + req.body.siteEmail + '",\n\n';

  configScript += '\t// Host information\n';
  configScript += '\thost: "localhost",\n';
  configScript += '\tport: 3000,\n\n';
  configScript += '\t//Site operation settings\n';
  configScript += '\tmaintenanceMode: false,\n\n';
  configScript += '}\n\n';

  configScript += '// Environment based options\n';
  configScript += 'switch (process.env.NODE_ENV){\n';
  configScript += '\tcase \'production\':\n';
  configScript += '\t\tconfig.dbHost = "localhost";\n';
  configScript += '\t\tconfig.dbName = "' + req.body.dbName + '";\n';
  configScript += '\t\tconfig.dbUser = "' + req.body.dbUser + '";\n';
  configScript += '\t\tconfig.dbPassword = "' + req.body.dbPassword + '";\n';
  configScript += '\t\tbreak;\n';

  configScript += '\tcase \'development\':\n';
  configScript += '\t\tconfig.dbHost = "localhost";\n';
  configScript += '\t\tconfig.dbName = "' + environments.development.dbName + '";\n';
  configScript += '\t\tconfig.dbUser = "' + environments.development.dbUser + '";\n';
  configScript += '\t\tconfig.dbPassword = "' + environments.development.dbPassword + '";\n';
  configScript += '\t\tbreak;\n';

  configScript += '\tcase \'test\':\n';
  configScript += '\t\tconfig.dbHost = "localhost";\n';
  configScript += '\t\tconfig.dbName = "' + environments.test.dbName + '";\n';
  configScript += '\t\tconfig.dbUser = "' + environments.test.dbUser + '";\n';
  configScript += '\t\tconfig.dbPassword = "' + environments.test.dbPassword + '";\n';
  configScript += '\t\tbreak;\n';
  
  configScript += '\tcase \'default\':\n';
  configScript += '\t\tconfig.dbHost = "localhost";\n';
  configScript += '\t\tconfig.dbName = "' + environments.development.dbName + '";\n';
  configScript += '\t\tconfig.dbUser = "' + environments.development.dbUser + '";\n';
  configScript += '\t\tconfig.dbPassword = "' + environments.development.dbPassword + '";\n';
  configScript += '\t\tbreak;\n';
  
  configScript += '}\n\n';

  configScript += 'exports.configObj = config;';
    
  //create config file and write contents
  // set options to ensure config.js is only readable by the owner (mode: 384 is 600 in octal i.e. only owner has r+w privileges)
  var fileOptions = {
    encoding: 'utf8',
    mode: 384,
    flag: 'w',
  };
  
  fs.writeFile(handyDirectory + '/config/handy-config.js', configScript, fileOptions, function(err){
    if(err){return callback(err);}
    return callback(null);
    
  });
}

/*
// default settings for cron
var defaultCronSettings = [];

defaultCronSettings[0] = {
  taskName: 'handy submit XML sitemap',
  description: {
    run: content.submitXmlSitemap,
    freq: 1440,
    lastrun: null
  }
};
*/

/*
 * default configuration settings
 * convenience function designed to move potentially lengthy configuration
 * defaults to the bottom of the page
 */
function _defaultConfig(config){
  // cron settings
  this.cronDefault = [
    {
      taskName: 'handy submit XML sitemap',
      description: {
        run: content.submitXmlSitemap,
        freq: 1440,
        lastrun: null
      }
    }
  ];
  
  // theme head
  this.theme_head = '<meta charset="utf-8">\n';
  this.theme_head += '<meta http-equiv="X-UA-Compatible" content="IE=edge">\n';
  this.theme_head += '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  this.theme_head += '[theme_title]\n';
  this.theme_head += '[theme_description]\n';
  this.theme_head += '[theme_canonical]\n';
  this.theme_head += '\n<!--load stylesheets-->\n';
  this.theme_head += '<link rel="stylesheet" href="/css/bootstrap-3.1.1.min.css">\n';
  this.theme_head += '<link rel="stylesheet" href="/css/font-awesome.min.css">\n';
  this.theme_head += '<link rel="stylesheet" href="/css/handy-style.css">\n';
  this.theme_head += '\n';
  this.theme_head += '[theme_ga]\n';

  // theme section header
  this.theme_section_header = '<header>\n';
  this.theme_section_header += '\t<nav class="navbar navbar-default navbar-static-top" role="navigation">\n';
  this.theme_section_header += '\t\t<div class="container-fluid">\n';
  this.theme_section_header += '\t\t\t<div class="navbar-header">\n';
  this.theme_section_header += '\t\t\t\t<button class="navbar-toggle" type="button" data-toggle="collapse" data-target="#navbar-collapse">\n';
  this.theme_section_header += '\t\t\t\t\t<span class="sr-only">Toggle navigation only</span>\n';
  this.theme_section_header += '\t\t\t\t\t<span class="icon-bar"></span>\n';
  this.theme_section_header += '\t\t\t\t\t<span class="icon-bar"></span>\n';
  this.theme_section_header += '\t\t\t\t\t<span class="icon-bar"></span>\n';
  this.theme_section_header += '\t\t\t\t</button>\n';
  this.theme_section_header += '\t\t\t\t<a class="navbar-brand" href="/">';
  this.theme_section_header += '[theme_sitename]';
  this.theme_section_header += '</a>\n';
  this.theme_section_header += '\t\t\t</div><!--navbar-header-->\n';
  this.theme_section_header += '\t\t\t<div class="collapse navbar-collapse" id="login-logout">\n';
  this.theme_section_header += '\t\t\t\t<ul class="nav navbar-nav navbar-right">\n';
  this.theme_section_header += '\t\t\t\t\t<li>';
  this.theme_section_header += '[theme_login-logout]';
  this.theme_section_header += '</li>\n';
  this.theme_section_header += '\t\t\t\t</ul>\n';
  this.theme_section_header += '\t\t\t</div><!--login-logout-->\n';
  this.theme_section_header += '\t\t</div><!--container-fluid-->\n';
  this.theme_section_header += '\t</nav>\n';
  this.theme_section_header += '</header>';

  // system messages
  this.theme_messages = '<section id="messages"><!--system message alerts-->\n\t [theme_messages] \n</section>';

  // theme section bottom scripts
  this.theme_section_bottomscripts = '<section id="bottomscripts"><!--scripts loaded after main content-->\n';
  this.theme_section_bottomscripts += '\t<script src="/js/jquery-1.11.0.js"></script>\n';
  this.theme_section_bottomscripts += '\t<script src="/js/bootstrap-3.1.1.min.js"></script>\n';
  this.theme_section_bottomscripts += '\t<script src="/js/handy-client.js"></script>\n';
  this.theme_section_bottomscripts += '</section>'

  // theme section extras
  this.theme_section_extras = '<section id="extras"><!--extra scripts or content as needed-->\n';
  this.theme_section_extras += '\n';
  this.theme_section_extras += '</section>';

  // theme section footer
  this.theme_section_footer = '<footer id="pageFooter">\n';
  this.theme_section_footer += '\t<div.class="container">\n';
  this.theme_section_footer += '\t\t<div class="footer_top">\n';
  this.theme_section_footer += '\t\t\t<div class="row">\n';
  this.theme_section_footer += '\t\t\t\t<div class="col-md-3">\n';
  this.theme_section_footer += '\t\t\t\t\t<p></p>\n';
  this.theme_section_footer += '\t\t\t\t</div>\n';
  this.theme_section_footer += '\t\t\t\t<div class="col-md-4 col-md-offset-5">\n';
  this.theme_section_footer += '\t\t\t\t\t<ul class="list-inline">\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li><a href="/contact">contact us</a></li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li><a href="#" data-toggle="modal" data-target="#privacy_modal"> privacy</a></li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li><a href="#" data-toggle="modal" data-target="#terms_modal">terms</a></li>\n';
  this.theme_section_footer += '\t\t\t\t\t</ul>\n';
  this.theme_section_footer += '\t\t\t\t</div><!-- col-md-4 -->\n';
  this.theme_section_footer += '\t\t\t</div><!-- row -->\n';
  this.theme_section_footer += '\t\t</div><!-- footer_top -->\n';
  this.theme_section_footer += '\t\t<div class="footer_bottom">\n';
  this.theme_section_footer += '\t\t\t<div class="row">\n';
  this.theme_section_footer += '\t\t\t\t<div class="col-md-4">\n';
  this.theme_section_footer += '\t\t\t\t\t<p class="inline_block">Built with &nbsp;</p>\n';
  this.theme_section_footer += '\t\t\t\t\t<a href="http://handyjs.org" target="_blank">\n';
  this.theme_section_footer += '\t\t\t\t\t\t<img src="/img/handylogo.png" alt="handy.js logo" width=93px height=37px>\n';
  this.theme_section_footer += '\t\t\t\t\t</a>\n';
  this.theme_section_footer += '\t\t\t\t</div><!-- col-md-4 -->\n';
  this.theme_section_footer += '\t\t\t\t<div class="col-md-4 col-md-offset-4">\n';
  this.theme_section_footer += '\t\t\t\t<p class="text-right"></p>\n';
  this.theme_section_footer += '\t\t\t\t</div><!-- col-md-4 -->\n';
  this.theme_section_footer += '\t\t\t</div><!-- row -->\n';
  this.theme_section_footer += '\t\t</div><!-- footer_bottom -->\n';
  this.theme_section_footer += '\t</div><!-- container -->\n';
  this.theme_section_footer += '</footer>\n';
  this.theme_section_footer += '<section id="terms">\n';
  this.theme_section_footer += '\t<div id="terms_modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">\n';
  this.theme_section_footer += '\t\t<div class="modal-dialog">\n';
  this.theme_section_footer += '\t\t\t<div class="modal-content">\n';
  this.theme_section_footer += '\t\t\t\t<div class="modal-header">\n';
  this.theme_section_footer += '\t\t\t\t\t<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>\n';
  this.theme_section_footer += '\t\t\t\t\t<h4 class="modal-title">Terms and Conditions</h4>\n';
  this.theme_section_footer += '\t\t\t\t</div>\n';
  this.theme_section_footer += '\t\t\t\t<div class="modal-body">\n';
  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t1. Terms\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t\tBy accessing this web site, you are agreeing to be bound by these ';
  this.theme_section_footer += '\t\t\t\t\t\tweb site Terms and Conditions of Use, all applicable laws and regulations, ';
  this.theme_section_footer += '\t\t\t\t\t\tand agree that you are responsible for compliance with any applicable local ';
  this.theme_section_footer += '\t\t\t\t\t\tusing or accessing this site. The materials contained in this web site are ';
  this.theme_section_footer += '\t\t\t\t\t\tprotected by applicable copyright and trade mark law.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';
  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t2. Use License\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<ol type="a">\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tPermission is granted to temporarily download one copy of the materials ';
  this.theme_section_footer += '\t\t\t\t\t\t\t(information or software) on [theme_sitename]\'s web site for personal, ';
  this.theme_section_footer += '\t\t\t\t\t\t\tnon-commercial transitory viewing only. This is the grant of a license, ';
  this.theme_section_footer += '\t\t\t\t\t\t\tnot a transfer of title, and under this license you may not:\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t<ol type="i">\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t\t<li>modify or copy the materials;</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t\t<li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t\t<li>attempt to decompile or reverse engineer any software contained on [theme_sitename]\'s web site;</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t\t<li>remove any copyright or other proprietary notations from the materials; or</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t\t<li>transfer the materials to another person or "mirror" the materials on any other server.</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\t</ol>\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tThis license shall automatically terminate if you violate any of these restrictions and may be terminated by [theme_sitename] at any time. Upon terminating your viewing of these materials or upon the termination of this license, you must destroy any downloaded materials in your possession whether in electronic or printed format.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t</ol>\n';

  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t3. Disclaimer\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<ol type="a">\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tThe materials on [theme_sitename]\'s web site are provided "as is". [theme_sitename] makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties, including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights. Further, [theme_sitename] does not warrant or make any representations concerning the accuracy, likely results, or reliability of the use of the materials on its Internet web site or otherwise relating to such materials or on any sites linked to this site.\n';
  this.theme_section_footer += '\t\t\t\t\t</ol>\n';

  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t4. Limitations\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\tIn no event shall [theme_sitename] or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption,) arising out of the use or inability to use the materials on [theme_sitename]\'s Internet site, even if [theme_sitename] or a [theme_sitename] authorized representative has been notified orally or in writing of the possibility of such damage. Because some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, these limitations may not apply to you.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';

  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t5. Revisions and Errata\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\tThe materials appearing on [theme_sitename]\'s web site could include technical, typographical, or photographic errors. [theme_sitename] does not warrant that any of the materials on its web site are accurate, complete, or current. [theme_sitename] may make changes to the materials contained on its web site at any time without notice. [theme_sitename] does not, however, make any commitment to update the materials.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';

  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t6. Links\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t[theme_sitename] has not reviewed all of the sites linked to its Internet web site and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by [theme_sitename] of the site. Use of any such linked web site is at the user\'s own risk.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';

  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t7. Site Terms of Use Modifications\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t[theme_sitename] may revise these terms of use for its web site at any time without notice. By using this web site you are agreeing to be bound by the then current version of these Terms and Conditions of Use.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';

  this.theme_section_footer += '\t\t\t\t\t<h3>\n';
  this.theme_section_footer += '\t\t\t\t\t\t8. Governing Law\n';
  this.theme_section_footer += '\t\t\t\t\t</h3>\n';
  this.theme_section_footer += '\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t\tAny claim relating to [theme_sitename]\'s web site shall be governed by the laws of the State of California without regard to its conflict of law provisions.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';

  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t\tGeneral Terms and Conditions applicable to Use of a Web Site.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';

  this.theme_section_footer += '\t\t\t\t</div>\n';
  this.theme_section_footer += '\t\t\t\t<div class="modal-footer">\n';
  this.theme_section_footer += '\t\t\t\t\t<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n';
  this.theme_section_footer += '\t\t\t\t</div>\n';

  this.theme_section_footer += '\t\t\t</div><!--modal-content -->\n';
  this.theme_section_footer += '\t\t</div><!--modal-dialog -->\n';
  this.theme_section_footer += '\t</div><!--modal -->\n';
  this.theme_section_footer += '</section>\n';

  this.theme_section_footer += '<section id="privacy">\n';
  this.theme_section_footer += '\t<div class="modal fade" id="privacy_modal" tabindex="-1" role="dialog" aria-labelledby="privacy" aria-hidden="true">\n';
  this.theme_section_footer += '\t\t<div class="modal-dialog">\n';
  this.theme_section_footer += '\t\t\t<div class="modal-content">\n';
  this.theme_section_footer += '\t\t\t\t<div class="modal-header">\n';
  this.theme_section_footer += '\t\t\t\t\t<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>\n';
  this.theme_section_footer += '\t\t\t\t\t<h4 class="modal-title">Privacy policy</h4>\n';
  this.theme_section_footer += '\t\t\t\t</div>\n';
  this.theme_section_footer += '\t\t\t\t<div class="modal-body">\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t\tYour privacy is very important to us. Accordingly, we have developed this Policy in order for you to understand how we collect, use, communicate and disclose and make use of personal information. The following outlines our privacy policy.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';
  this.theme_section_footer += '\t\t\t\t\t<ul>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tBefore or at the time of collecting personal information, we will identify the purposes for which information is being collected.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tWe will collect and use of personal information solely with the objective of fulfilling those purposes specified by us and for other compatible purposes, unless we obtain the consent of the individual concerned or as required by law.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tWe will only retain personal information as long as necessary for the fulfillment of those purposes.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tWe will collect personal information by lawful and fair means and, where appropriate, with the knowledge or consent of the individual concerned.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tPersonal data should be relevant to the purposes for which it is to be used, and, to the extent necessary for those purposes, should be accurate, complete, and up-to-date.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tWe will protect personal information by reasonable security safeguards against loss or theft, as well as unauthorized access, disclosure, copying, use or modification.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t<li>\n';
  this.theme_section_footer += '\t\t\t\t\t\t\tWe will make readily available to customers information about our policies and practices relating to the management of personal information.\n';
  this.theme_section_footer += '\t\t\t\t\t\t</li>\n';
  this.theme_section_footer += '\t\t\t\t\t</ul>\n';
  this.theme_section_footer += '\t\t\t\t\t<p>\n';
  this.theme_section_footer += '\t\t\t\t\t\tWe are committed to conducting our business in accordance with these principles in order to ensure that the confidentiality of personal information is protected and maintained.\n';
  this.theme_section_footer += '\t\t\t\t\t</p>\n';
  this.theme_section_footer += '\t\t\t\t</div>\n';
  this.theme_section_footer += '\t\t\t\t<div class="modal-footer">\n';
  this.theme_section_footer += '\t\t\t\t\t<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n';
  this.theme_section_footer += '\t\t\t\t</div>\n';
  this.theme_section_footer += '\t\t\t</div><!--modal-content -->\n';
  this.theme_section_footer += '\t\t</div><!--modal-dialog -->\n';
  this.theme_section_footer += '\t</div><!--modal -->\n';
  this.theme_section_footer += '</section>';

  return this[config];
}
