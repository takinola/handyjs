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

// get the location of the handy directory
var currentDirectory = __dirname.split('/');
currentDirectory.pop();
var handyDirectory = currentDirectory.reduce(function(prev, curr){
  return prev + '/' + curr;
},'');


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
    _initializeCronTasks.bind(null, defaultCronSettings),
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
    
    // add backup to the cron
    var freq = system.systemVariable.getConfig('backupFreq');
    var destination = system.systemVariable.getConfig('backupDestination');
    var destType = system.systemVariable.getConfig('backupDestinationType');
    if (freq && destination && destType){
      freq = parseInt(freq) * 60;
      system.addCronTask('handy scheduled backup', system.backupDatabase, freq, function(err){
        if(err){callback(err);}
        callback();
      });
    } else {
      callback();
    }
  });
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
    _initializeCronTasks.bind(null, defaultCronSettings),
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
      console.log('check req.session.user after running installation:\n', req.session.user);
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
    cronPath = encodeURIComponent(cronPath);  // make url safe
  
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