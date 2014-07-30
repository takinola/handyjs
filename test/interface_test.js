/*
 * Test suite for user interface of handy.js
 */
var expect = require('expect.js')
  , http = require('http')
  , handy = require('../lib/handy')
  , _ = require('underscore')
  , mysql = require('mysql')
  , Browser = require('zombie')
  , async = require('async')
  ;

// set environment to "test"
process.env.NODE_ENV = 'test';
var app
  , adminName = 'test admin'
  , adminEmail = 'test@admin.com'
  , adminPassword = 'ctff55r87vgcseww'
  , baseUrl = 'http://127.0.0.1:3000'
  , defaultUrl = '/welcomepage'
  , siteEmailPassword = '7vu3G2Df'
  , googleAnalyticsId = 'UA-test'
  , backupDestination = 'test@test.com'
  , siteEmailHost = 'smtp.gmail.com'
  ;

describe('User interface test suite', function(){
  this.timeout(10000);  // some tests take a while to complete
  
  before(function(){
    // set up details for new user for attempting registration
    this.createNewRegisterUser = function(){
      this.ctr = this.ctr + 1 || 1;  // initialize ctr as 1 on the first call
      this.username = 'registerUser_' + this.ctr;
      // use example.com as domain since the email generated will be discarded and not cause any inadvertent problems
      this.email = this.username + '@example.com';
      this.password = Math.random().toString(36).slice(-8);
      return {name: this.username, email: this.email, password: this.password};
    };
  });
  
  before(function(done){
    // set up test database
    console.log('\nsetting up test database...');
    var connectionOptions = {
      host: 'localhost',
      user: 'testuser',
      password: 'testpassword',
      connectionLimit: 100
    };
    this.testdb = 'testdb';
    
    this.pool = mysql.createPool(connectionOptions);
    var query = 'DROP DATABASE IF EXISTS ' + this.testdb;
    this.pool.getConnection((function(err, connection){
      if(err){done(err);}
      connection.query(query, (function(err, results){
        if(err){done(err);}
        query = 'CREATE DATABASE IF NOT EXISTS ' + this.testdb;
        connection.query(query, (function(err, results){
          connection.release();
          // now that the database exists, update the pool with the database name
          connectionOptions.database = this.testdb;
          this.pool = mysql.createPool(connectionOptions);
          handy.system.systemVariable.set('dbReady', true);  // set flag to indicate test database has been created
          done(err);    
        }).bind(this));
      }).bind(this));
    }).bind(this));
  });
  
  before(function(done){
    // start the application initialization
    console.log('\ninitializing the app...');
    var start = require('../../app');
    app = start.app;
    
    // this function implements a non-blocking wait for the bootstrap initialization process to complete
    console.log('\nwaiting for the bootstrap initialization sequence to complete...');
    wait();
    
    function wait(){
      if(handy.system.systemVariable.get('testFlag') !== true || handy.system.systemVariable.get('dbReady') !== true){
        setTimeout(wait, 1000);
      } else {
        _continueTest();
      }
    }

    function _continueTest(){
      // at this point, the initialization sequence is done but the app is in an 'installation required' state
      console.log('\ninitialization sequence complete.  moving on...');
      done();
    }
  });
  
  before(function(done){
    // start web server
    console.log('\nstarting the webserver');
    this.server = http.createServer(app).listen(3000);
    
    // get the production environment variables so that we can properly install the site without disrupting the original production set up
    process.env.NODE_ENV = 'production';
    var temp = require('../config/handy-config.js');
    this.siteName = temp.configObj.siteName;
    this.siteEmail = temp.configObj.siteEmail;
    this.host = temp.configObj.host;
    this.port = temp.configObj.port;
    this.maintenanceMode = temp.configObj.mantenanceMode;
    this.prodDbName = temp.configObj.dbName;
    this.prodDbHost = temp.configObj.dbHost;
    this.prodDbUser = temp.configObj.dbUser;
    this.prodDbPassword = temp.configObj.dbPassword;
    process.env.NODE_ENV = 'test';
    done();
  });
  
  before(function(done){
    // set the base url
    console.log('\nsetting browser to ' + baseUrl);
    this.browser = new Browser({site: baseUrl, maxWait: 10});
    this.browser.visit(baseUrl)
    .then(done)
    .fail(function(err){console.log('error with browser.visit: ', err); done(err);});
  });
  
  before(function(){
    /* declare a function that helps us know if a page is fully loaded
     * useful for tests where it takes a while for the program logic to return the requested
     * page leading to zombiejs timing errors
     */
    var browser = this.browser;
    this._pageloaded = (function(window){
      return window.document.querySelector('body');  // detect the 'body' component of the page
      //return this.browser.window.document.querySelector('body');  // detect the 'body' component of the page
    }).bind(this);
  });
  
  after(function(done){
    // logout user (so the Redis session database does not get confused when the test is re-run) and drop the database
    console.log('\ntests completed. cleaning up...');
    
    /* NEED to fix this as an error is thrown if there is no logged in user when visiting '/logout'
     * need some way to only logout if needed
     * WILL fix later
     */
    this.browser.visit('\logout')
    .fail((function(){
      console.log('\nuser already logged out');
      this.server.close();
      var query = 'DROP DATABASE ' + this.testdb;
      this.pool.getConnection(function(err, connection){
        if(err){return done(err);}
        connection.query(query, function(err){
          done(err);
        });
      }); 
    }).bind(this))
    .then((function(){
      this.server.close();
      var query = 'DROP DATABASE ' + this.testdb;
      this.pool.getConnection(function(err, connection){
        if(err){return done(err);}
        connection.query(query, function(err){
          done(err);
        });
      });   
    }).bind(this));
  });
  
  it('Check installation: front page redirect, install process', function(done){
    // initial state: browser is pointed at '/'
    expect(this.browser.text('h1')).to.be('Welcome to your new Handy site');

    this.browser.fill('siteName', this.siteName)
    .fill('siteEmail', this.siteEmail)
    .fill('dbName', this.prodDbName)
    .fill('dbUser', this.prodDbUser)
    .fill('dbPassword', this.prodDbPassword)
    .fill('adminName', adminName)
    .fill('adminEmail', adminEmail)
    .fill('adminPassword', adminPassword)
    .fill('adminPasswordConf', adminPassword)
    .pressButton('Begin installation', (function(){
      console.log('\nrunning installation...');
      expect(this.browser.success).to.be(true);
      expect(this.browser.location.pathname).to.be('/configuration');
      expect(this.browser.text('h1')).to.be('Configuration Options');
      // installation function changes the pool to point to the production database.  need to point back to test database
      handy.system.systemVariable.set('pool', this.pool);
      done();
    }).bind(this));
  });
  
  it('Check Configuration: configGeneral', function(done){
    // initial state: site installation done.  browser pointed at '/configuration'
    expect(this.browser.field('siteName').value).to.be(this.siteName);
    expect(this.browser.field('siteEmail').value).to.be(this.siteEmail);
    expect(handy.system.systemVariable.get('installation_flag')).to.be(true);
    this.browser
    .fill('defaultFrontPage', defaultUrl)
    .fill('default404Page', defaultUrl)
    .fill('default403Page', defaultUrl)
    .fill('siteEmailPassword', siteEmailPassword)
    .fill('googleAnalyticsId', googleAnalyticsId)
    .fill('backupDestination', backupDestination)
    .fill('siteEmailHost', siteEmailHost)
    .pressButton('form#configGeneral button')
    .then((function(){
      console.log('\ntesting configGeneral form saves entries...');
      expect(this.browser.text('div.alert h4')).to.be('Cool!');
      expect(this.browser.text('div.alert p')).to.be('Changes saved');
      return;
    }).bind(this))
    .fail((function(err){console.log('error:\n', this.browser.html('div.alert'));}).bind(this))
    .then(done, done);
  });
  
  it('Check defaultFrontpage', function(done){
    // initial state: browser pointed at '/configuration'
    this.browser
    .visit(baseUrl)
    .then((function(){
      console.log('\nchecking defaultFrontpage setting works....');
      expect(this.browser.location.href).to.be(baseUrl + defaultUrl);
      return;
    }).bind(this))
    .then(done, done);
  });
  
  it('Check default404page', function(done){
    // initial state: browser pointed at '/configuration'
    this.browser
    .visit('/unknownpageshouldgive404')
    .then((function(){
      console.log('\nchecking default404page setting works....');
      expect().fail();  //  this should not run as the promise should fail, triggering the fail code 
      return;
    }).bind(this))
    .fail((function(error){
      //expect(this.browser.location.pathname).to.be(defaultUrl);  // zombie bug prevents this from passing (404 and 403 redirects are not followed)
      expect(this.browser.statusCode).to.be(404);
      //done();
      return;
    }).bind(this))
    .then(done, done);
  });
  
  it('Check default403page', function(done){
    // initial state: browser pointed at '/configuration'
    this.browser
    .visit('/accessdenied')
    .then((function(){
      expect().fail();  //  this should not run as the promise should fail, triggering the fail code 
      return;
    }).bind(this))
    .fail((function(error){
      console.log('\nchecking default403page setting works....');
      //expect(this.browser.location.pathname).to.be(defaultUrl); // zombie bug prevents this from passing (404 and 403 redirects are not followed)
      expect(this.browser.statusCode).to.be(403);
      //done();
      return;
    }).bind(this))
    .then(done, done);
  });
  
  it('Reset default pages', function(done){
    // initial state: browser pointed at '/configuration'
    this.browser
    .visit('/configuration')
    .then((function(){
      return this.browser
      .fill('defaultFrontPage', '')
      .fill('default404Page', '')
      .fill('default403Page', '')
      .pressButton('form#configGeneral button');
    }).bind(this))
    .then((function(){
      console.log('\nresetting default pages....');
      expect(this.browser.text('div.alert h4')).to.be('Cool!');
      expect(this.browser.text('div.alert p')).to.be('Changes saved');
      return;
    }).bind(this))
    .then(done, done);
  });
  
  it('Check configuration: configAccount', function(done){
    // initial state: browser pointed at '/configuration'
    var testAnonUser = 'test anonymous user';
    var testDelUser = 'test deleted user';
    this.browser
    .fill('anonUser', testAnonUser)
    .fill('deletedUser', testDelUser)
    .choose('#registerAuthority_1')
    .pressButton('form#configAccount button')
    .then((function(){
      console.log('\nchecking configAccount form saves settings....');
      expect(this.browser.field('anonUser').value).to.be(testAnonUser);
      expect(this.browser.field('deletedUser').value).to.be(testDelUser);
      expect(this.browser.document.querySelector('#registerAuthority_1').checked).to.be(true);  // register authority is admin
    }).bind(this))
    .fail((function(err){
      console.log('configAccount error:\n', this.browser.html('div.alert'));
      return;
    }).bind(this))
    .then((function(){
      return this.browser
      .visit('/logout')
      .then((function(){
        console.log('\nchecking logout functionality works....');
        expect(this.browser.location.pathname).to.be('/');  // log out admin
        return;
      }).bind(this))
      .fail((function(err){
        console.log('configAccount error:\n', this.browser.html('div.alert'), err);
        return;
      }).bind(this));
    }).bind(this))
    .then(done, done);
  });

  it.skip('Check user registration option: Administrator only', function(done){
    // initial state: browser pointed at '/configuration'
    var registerUser = this.createNewRegisterUser();
    this.browser
    .visit('/login')
    .then((function(){
      return this.browser
      .fill('#userRegister_userEmail', registerUser.email)
      .fill('#userRegister_userPassword', registerUser.password)
      .fill('#userRegister_userPasswordConf', registerUser.password)
      .pressButton('form#userRegister button')
      .then((function(){
        console.log('\nchecking user self registration does not work when the registerAuthority is "Administrator"....');
        // only administrators have permission to create accounts at this time
        expect(this.browser.text('div.alert p')).to.be('You do not have permission to register a new user account');
        expect(this.browser.text('title')).to.be('Login');  // should be back on login page
        // login admin and change the registration authority to "visitor"
        this.browser
        .fill('#userLogin_userEmail', adminEmail)
        .fill('#userLogin_userPassword', adminPassword);
      }).bind(this))
      .fail((function(err){
        console.log('userRegister error:\n', this.browser.html('div.alert'), err);
        return;        
      }).bind(this))
      .then((function(){
        return this.browser
        .pressButton('form#userLogin button');
      }).bind(this))
      .then((function(){
        expect(this.browser.location.pathname).to.be('/welcomepage');
        return this.browser
          .visit('/configuration')
          .then((function(){
            return this.browser
              .choose('#registerAuthority_2')
              .pressButton('form#configAccount button')
              .then((function(){
                console.log('\nregisterAuthority now changed to "visitor"....');
                expect(this.browser.document.querySelector('#registerAuthority_2').checked).to.be(true);
                return;
              }).bind(this))
              .then((function(){
                return this.browser
                .visit('/logout')
                .then((function(){
                  console.log('\nlogging out so we can check if visitors can now self-register....');
                  expect(this.browser.document.location.pathname).to.be('/');
                  return;
                }).bind(this));
              }).bind(this))
              .fail((function(err){
                console.log('configAccount error:\n', this.browser.html('div.alert'), err);
                return;
              }).bind(this));
            }).bind(this))
      }).bind(this));
    }).bind(this))
    .then(done, done);
  });
  
  it.skip('Check user registration option: Visitor and emailVerify: True', function(done){
    // // initial state: browser pointed to '/'.  user is logged out.  register authority is 'visitor'
    expect(this.browser.document.location.pathname).to.be('/');
    var registerUser = this.createNewRegisterUser();
    this.lastUserRegistered = registerUser;  // save the registerUser details for future tests
    this.browser
    .visit('/login')
    .then((function(){
      console.log('\nvisitor will now try to register....');
      return this.browser
      .fill('#userRegister_userEmail', registerUser.email)
      .fill('#userRegister_userPassword', registerUser.password)
      .fill('#userRegister_userPasswordConf', registerUser.password)
      .pressButton('form#userRegister button')
      .then((function(){
        // wait to ensure the page if fully loaded before continuing
        return this.browser.wait(this._pageLoaded, (function(){
          console.log('\naccount registration should be successful but the user should not be logged in.\nuser should be prompted to verify their email address');
          // user should be returned to login page with a registration successful message
          expect(this.browser.document.location.pathname).to.be('/login');
          expect(this.browser.text('div.alert p')).to.be('Registration successful. Please check your email for instructions on how to complete your registration');
          return;
        }).bind(this));
      }).bind(this));
    }).bind(this))
    .fail((function(err){
      console.log('userRegister error_2:\n', this.browser.html('div.alert'), err);
      return;        
    }).bind(this))
    .then(done, done);
  });
  
  it.skip('Check if one-time link works', function(done){
    // get one-time link from database
    this.pool.getConnection((function(err, connection){
      if(err){expect().fail('error establishing database pool'); return;}
      var query = 'SELECT onetimelink, onetimelinkhash, onetimelinktimestamp FROM user WHERE email=' + connection.escape(this.lastUserRegistered.email) + ' LIMIT 1';
      connection.query(query, (function(err, results){
        if(err){expect().fail('error executing database query'); return;}
        if(results.length < 1){ expect().fail('newly registered user record not found in database'); return;}
        // recreate registration confirmation link
        var oneTimeLink = baseUrl + '/verifyemail?email=' + encodeURIComponent(this.lastUserRegistered.email) + '&link=';
        oneTimeLink += encodeURIComponent(results[0].onetimelink);  // add onetime link to url
        
        // save the one-time link info for use in later tests
        this.lastUserRegistered.onetimelink = results[0].onetimelink;
        this.lastUserRegistered.onetimelinkhash = results[0].onetimelinkhash;
        this.lastUserRegistered.onetimelinktimestamp = results[0].onetimelinktimestamp;
        
        console.log('\none-time link generated.  now following the link...');
        this.browser.visit(oneTimeLink)
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\nuser should be logged in and directed to "/welcomepage" with a success message');
            expect(this.browser.location.pathname).to.be('/welcomepage');
            expect(this.browser.text('div.alert p')).to.be('Your email address has been verified, welcome!');
            return;
          }).bind(this));
        }).bind(this))
        .fail((function(err){
          console.log('userRegister error_3:\n', this.browser.html('div.alert'), err);
          return; 
        }).bind(this))
        .then((function(){
          console.log('\nlogging out...');
          this.browser.visit('logout');
        }).bind(this))
        .then(done, done);
      }).bind(this));
    }).bind(this));
  });
  
  it.skip('Check to ensure wrong one-time link fails', function(done){
    this.pool.getConnection((function(err, connection){
      if(err){expect().fail('error establishing database pool'); return;}
      console.log('\nreseting onetime link...');
      var query = 'UPDATE user SET onetimelink=' + connection.escape(this.lastUserRegistered.onetimelink);
      query += ', onetimelinkhash=' + connection.escape(this.lastUserRegistered.onetimelinkhash);
      query += ', onetimelinktimestamp=' + connection.escape(this.lastUserRegistered.onetimelinktimestamp);
      query += ' WHERE email=' + connection.escape(this.lastUserRegistered.email);
      connection.query(query, (function(err, results){
        if(err){expect().fail('error resetting onetimelink details'); return;}
        var wrongOneTimeLink = 'gibberish432294931i4ndjsnd';
        var oneTimeLink = baseUrl + '/verifyemail?email=' + encodeURIComponent(this.lastUserRegistered.email) + '&link=';
        oneTimeLink += encodeURIComponent(wrongOneTimeLink);
        
        console.log('\ntesting wrong one-time link...');
        this.browser.visit(oneTimeLink)
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\nuser should be redirected to frontpage with warning message...');
            expect(this.browser.location.pathname).to.be('/');
            expect(this.browser.text('div.alert p')).to.be('Verification failed! Try again or request another verification email be sent to you');
          }).bind(this));
        }).bind(this))
        .fail((function(err){
          console.log('userRegister error_4:\n', this.browser.html('div.alert'), err);
          return; 
        }).bind(this))
        .then(done, done);
      }).bind(this));
    }).bind(this));
  });
  
  it.skip('Check to ensure one-time links for non-existent user fails', function(done){
    this.pool.getConnection((function(err, connection){
      if(err){expect().fail('error establishing database pool'); return;}
      console.log('\nresetting onetime link...');
      var query = 'UPDATE user SET onetimelink=' + connection.escape(this.lastUserRegistered.onetimelink);
      query += ', onetimelinkhash=' + connection.escape(this.lastUserRegistered.onetimelinkhash);
      query += ', onetimelinktimestamp=' + connection.escape(this.lastUserRegistered.onetimelinktimestamp);
      query += ' WHERE email=' + connection.escape(this.lastUserRegistered.email);
      connection.query(query, (function(err, results){
        if(err){expect().fail('error resetting onetimelink details'); return;}
        var wrongUserEmail = 'unknownuser@unknown.com';
        var oneTimeLink = baseUrl + '/verifyemail?email=' + encodeURIComponent(wrongUserEmail) + '&link=';
        oneTimeLink += encodeURIComponent(this.lastUserRegistered.onetimelink);
        
        console.log('\ntesting one-time link for non-existent user...');
        this.browser.visit(oneTimeLink)
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\nuser should be redirected to frontpage with warning message...');
            expect(this.browser.location.pathname).to.be('/');
            expect(this.browser.text('div.alert p')).to.be('Verification failed! User not found.');
          }).bind(this));
        }).bind(this))
        .fail((function(err){
          console.log('userRegister error_5:\n', this.browser.html('div.alert'), err);
          return; 
        }).bind(this))
        .then(done, done);
      }).bind(this));
    }).bind(this));
  });
  
  it.skip('Check to ensure one-time links for email verification do not expire', function(done){
    this.pool.getConnection((function(err, connection){
      if(err){expect().fail('error establishing database pool'); return;}
      console.log('\nresetting onetime link with old timestamp...');
      // note expiredTimeStamp needs to be a Date object in order to be saved in the database table
      var expiredTimeStamp = new Date(new Date(this.lastUserRegistered.onetimelinktimestamp) - 1000*60*60*24*365);
      var query = 'UPDATE user SET onetimelink=' + connection.escape(this.lastUserRegistered.onetimelink);
      query += ', onetimelinkhash=' + connection.escape(this.lastUserRegistered.onetimelinkhash);
      query += ', onetimelinktimestamp=' + connection.escape(expiredTimeStamp);
      query += ' WHERE email=' + connection.escape(this.lastUserRegistered.email);
      connection.query(query, (function(err, results){
        if(err){expect().fail('error resetting onetimelink details'); return;}
        var oneTimeLink = baseUrl + '/verifyemail?email=' + encodeURIComponent(this.lastUserRegistered.email) + '&link=';
        oneTimeLink += encodeURIComponent(this.lastUserRegistered.onetimelink);
        
        console.log('\ntesting one-time link backdated one year...');
        this.browser.visit(oneTimeLink)
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\nuser should be logged in and directed to "/welcomepage" with a success message');
            expect(this.browser.location.pathname).to.be('/welcomepage');
            expect(this.browser.text('div.alert p')).to.be('Your email address has been verified, welcome!');
            return;
          }).bind(this));
        }).bind(this))
        .fail((function(err){
          console.log('userRegister error_6:\n', this.browser.html('div.alert'), err);
          return; 
        }).bind(this))
        .then((function(){
          // logout user
          console.log('\nlogging out...');
          this.browser.visit('/logout');
          return;
        }).bind(this))
        .then(done, done);
      }).bind(this));
    }).bind(this));
  });
  
  it.skip('Check user registration with emailVerify false', function(done){
    console.log('\nset emailVerify to false...');
    handy.system.systemVariable.updateConfig({emailVerify: false}, this.pool, (function(err){
      if(err){expect().fail('error setting emailVerify to false'); done();}
      // set up user for registration
      var registerUser = this.createNewRegisterUser();
      // going to '/login'
      this.browser.visit('/login')
      .then((function(){
        console.log('\nvisitor will now try to register...');
        return this.browser
        .fill('#userRegister_userEmail', registerUser.email)
        .fill('#userRegister_userPassword', registerUser.password)
        .fill('#userRegister_userPasswordConf', registerUser.password)
        .pressButton('form#userRegister button')
        .then((function(){
          // wait to ensure the page if fully loaded before continuing
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\naccount registration should be successful.\nthe user should be logged in with success message.');
            // user should be returned to login page with a registration successful message
            expect(this.browser.document.location.pathname).to.be('/welcomepage');
            expect(this.browser.text('div.alert p')).to.be('New user registration successful');
            
            // logout user
            console.log('\nlogging out...');
            this.browser.visit('/logout');
            return;
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('user registration email_verify_false error_1:\n', this.browser.html('div.alert'), err);
        return; 
      }).bind(this))
      .then(done, done);
    }).bind(this));
  });
  
  it.skip('Check user registration with registerAuthority "requireAdmin"', function(done){
    /* Tasks
     * check that user does not get access immediately
     * check that admin can approve user account
     */
    
    /* State Dependency
     * App is initialized and configured
     */
    
    
    var registerUser = this.createNewRegisterUser();
    var that = this;  // set temporary 'this' variable so we can utilize it inside the async call
    async.series([
      _setEmailVerifyTrue.bind(that),
      _setRegisterAdmin.bind(that),
      _registerUser.bind(that),
      _userLogin.bind(that, 'failure'),
      _approveUserRegistration.bind(that),
      _userLogin.bind(that, 'succeed'),
      _userLogout.bind(that)

      ],
      function(err, results){
        console.log('\nuser registration with registerAuthority requireAdmin test complete');
        done(err);  // end process with or without errors
      }
    );
    
    function _setEmailVerifyTrue(asyncCallback){
      console.log('\nsetting emailVerify to true...');
      handy.system.systemVariable.updateConfig({emailVerify: true}, this.pool, function(err){
        if(err){expect().fail('error setting emailVerify to true');}
        asyncCallback(err);
      });
    }
    
    function _setRegisterAdmin(asyncCallback){
      console.log('\nsetting registerAuthority to requireadmin...');
      handy.system.systemVariable.updateConfig({registerAuthority: 'requireAdmin'}, this.pool, function(err){
        if(err){expect().fail('error setting registerAuthority to requireAdmin');}
        asyncCallback(err);
      });
    }
    
    function _registerUser(asyncCallback){
      console.log('\ngoing to /login...');
      //expect(this.browser.document.location.pathname).to.be('/');
      this.browser.visit('/login')
      .then((function(){
        console.log('\nvisitor will now try to register...');
        this.browser
        .fill('#userRegister_userEmail', registerUser.email)
        .fill('#userRegister_userPassword', registerUser.password)
        .fill('#userRegister_userPasswordConf', registerUser.password)
        .pressButton('form#userRegister button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\naccount registration should be successful but the user should not be logged in.\nuser should be informed that their account is pending approval');
            expect(this.browser.document.location.pathname).to.be('/login');
            expect(this.browser.text('div.alert p')).to.be('Registration successful. Please check your email for instructions on how to complete your registration');
            asyncCallback(null);              
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at user registration registerAuthority requireAdmin _registerUser:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
      }).bind(this));
    }
    
    function _approveUserRegistration(asyncCallback){
      console.log('\nadmin loggng in to approve user registration...');
      this.browser.visit('/login')
      .then((function(){
        this.browser
        .fill('#userLogin_userEmail', adminEmail)
        .fill('#userLogin_userPassword', adminPassword)
        .pressButton('#userLogin button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\nadmin is now logged in....');
            expect(this.browser.document.location.pathname).to.be('/welcomepage');
            expect(this.browser.text('div.alert p')).to.be('Welcome ' + adminName);
          
            this.browser.visit('/configuration')
            .then((function(){
              console.log('\nchecking if the approval request is present...');
              var approvalRequests = this.browser.document.getElementById('userRegisterApproval').getElementsByTagName('input');
              console.log('\napproving registration request...');
              // screen out non-checkbox inputs e.g. csrf input
              for(var ctr=0; ctr<approvalRequests.length; ctr++){
                if(approvalRequests[ctr].type === 'checkbox'){
                  approvalRequests[ctr].checked = true;
                }
              }
              this.browser
              .pressButton('form#userRegisterApproval button')
              .then((function(){
                return this.browser.wait(this._pageLoaded, (function(){
                  console.log('\nlogging out admin...');
                  this.browser.visit('/logout')
                  .then((function(){
                    // wait for logout to complete before ending the function
                    asyncCallback(null);
                  }).bind(this));
                }).bind(this));
              }).bind(this));
            }).bind(this))
            .fail((function(){
              console.log('\nerror at user registration registerAuthority requireAdmin _approveUserRegistration:\n', this.browser.html('div.alert'), err);
              asyncCallback(err);
            }).bind(this));
          }).bind(this));
        }).bind(this));
      }).bind(this));
    }
    
    function _userLogin(expectation, asyncCallback){
      console.log('\nattempting user login...');
      console.log('expectation is ' + expectation);
      this.browser.visit('/login')
      .then((function(){
        this.browser
        .fill('#userLogin_userEmail', registerUser.email)
        .fill('#userLogin_userPassword', registerUser.password)
        .pressButton('#userLogin button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\ntesting if registered user login is successful...');
            // return test result depending on whether the user login is expected to be successful or fail
            switch (expectation){
              case 'succeed':
                expect(this.browser.document.location.pathname).to.be('/welcomepage');
                break;
              case 'failure':
                expect(this.browser.document.location.pathname).not.to.be('/welcomepage');
                break;
            }
            asyncCallback(null);
          }).bind(this));
        }).bind(this))
        .fail((function(){
          return function(){
            // this branch will run because an unverified user trying to login returns a 403 code
            console.log('fail function ran');
            expect(expectation).to.be('failure');
            asyncCallback(null); 
          }
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at user registration registerAuthority requireAdmin _userLogin:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
      }).bind(this));
    }
    
    function _userLogout(asyncCallback){
      console.log('\nlogging out user...')
      this.browser.visit('/logout')
      .then(function(){
        asyncCallback(null)
      })
      .fail(function(){
        asyncCallback(null);
      });
    }
    
  });
  
  it.skip('Check user can change password', function(done){
    /* Tasks
     * Check password change is successful (and previous password is disabled)
     */
    
    /* State Dependency
     * App is initialized and configured
     */
    
    var registerUser = this.createNewRegisterUser();
    registerUser.newPassword = Math.random().toString(36).slice(-8);
    
    var that = this;  // temporary storage for this so it can be passed into async
    
    async.series([
      _setEmailVerifyFalse.bind(that),
      _setRegisterVisitor.bind(that),
      _registerUser.bind(that),
      _changePassword.bind(that),
      _userLogin.bind(that, registerUser.password, 'failure'),
      _userLogin.bind(that, registerUser.newPassword, 'succeed'),
      _userLogout.bind(that)
      ],
      function(err, results){
        console.log('\ncheck user can change password test complete');
        done(err);
      }
    
    );
    
    // remove email verification
    function _setEmailVerifyFalse(asyncCallback){
      console.log('\nsetting emailVerify to false...');
      handy.system.systemVariable.updateConfig({emailVerify: false}, this.pool, function(err){
        if(err){expect().fail('error setting emailVerify to false');}
        asyncCallback(err);
      });
    }
    
    // allow visitors to register accounts
    function _setRegisterVisitor(asyncCallback){
      console.log('\nsetting registerAuthority to visitor...');
      handy.system.systemVariable.updateConfig({registerAuthority: 'visitor'}, this.pool, function(err){
        if(err){expect().fail('error setting registerAuthority to visitor');}
        asyncCallback(err);
      });
    }
    
    // create new account
    function _registerUser(asyncCallback){
      this.browser.visit('/login')
      .then((function(){
        console.log('\nvisitor will now try to register...');
        this.browser
        .fill('#userRegister_userEmail', registerUser.email)
        .fill('#userRegister_userPassword', registerUser.password)
        .fill('#userRegister_userPasswordConf', registerUser.password)
        .pressButton('form#userRegister button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\naccount registration should be successful and the user should be logged in.');
            expect(this.browser.document.location.pathname).to.be('/welcomepage');
            asyncCallback(null);              
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can change password _registerUser:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
        return;
      }).bind(this));
    }
    
    function _changePassword(asyncCallback){
      this.browser.visit('/password/change')
      .then((function(){
        console.log('\nnow changing the password');
        this.browser
        .fill('#oldPassword', registerUser.password)
        .fill('#newPassword', registerUser.newPassword)
        .fill('#newPasswordConf', registerUser.newPassword)
        .pressButton('form#passwordChange button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\npassword change should be successful. now logging out...');
            this.browser.visit('/logout')
            .then((function(){
              // wait for logout to complete before ending the function
              console.log('\nnew user logged out...')
              asyncCallback(null);
            }).bind(this));            
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can change password _changePassword:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
        return;
      }).bind(this));
    }
    
    function _userLogin(password, expectation, asyncCallback){
      console.log('\nattempting user login...');
      console.log('expectation is ' + expectation);
      this.browser.visit('/login')
      .then((function(){
        this.browser
        .fill('#userLogin_userEmail', registerUser.email)
        .fill('#userLogin_userPassword', password)
        .pressButton('#userLogin button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\ntesting if registered user login is successful...');
            // return test result depending on whether the user login is expected to be successful or fail
            switch (expectation.toLowerCase()){
              case 'succeed':
                expect(this.browser.document.location.pathname).to.be('/welcomepage');
                break;
              case 'failure':
                expect(this.browser.document.location.pathname).not.to.be('/welcomepage');
                break;
            }
            asyncCallback(null);
          }).bind(this));
        }).bind(this))
        .fail((function(){
          return function(){
            // this branch will run because an unverified user trying to login returns a 403 code
            console.log('fail function ran');
            expect(expectation).to.be('failure');
            asyncCallback(null); 
          }
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can change password _userLogin:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
      }).bind(this));
    }
    
    function _userLogout(asyncCallback){
      console.log('\nlogging out user...');
      this.browser.visit('/logout')
      .then(function(){
        asyncCallback(null)
      })
      .fail(function(){
        asyncCallback(null);
      });
    }

  });
  
  it.skip('Check that user can reset password', function(done){
    /* Tasks
     * Check password reset is successful (and previous password is disabled)
     * Other tests verify that one-time links expire properly, are verified correctly etc so these checks will
     * not be tested here
     */
    
    /* State Dependency
     * App is initialized and configured
     */
    
    var registerUser = this.createNewRegisterUser();
    registerUser.newPassword = Math.random().toString(36).slice(-8);
    
    var that = this;  // temporary storage for this so it can be passed into async
    
    async.series([
      _setEmailVerifyFalse.bind(that),
      _setRegisterVisitor.bind(that),
      _registerUser.bind(that),
      _userLogout.bind(that),
      _requestPasswordReset.bind(that),
      _resetPassword.bind(that),
      _userLogout.bind(that),
      _userLogin.bind(that, registerUser.password, 'failure'),
      _userLogin.bind(that, registerUser.newPassword, 'succeed')
      ],
      function(err, results){
        console.log('\ncheck user can reset password test complete');
        done(err);
      }
    );
    
    // remove email verification
    function _setEmailVerifyFalse(asyncCallback){
      console.log('\nsetting emailVerify to false...');
      handy.system.systemVariable.updateConfig({emailVerify: false}, this.pool, function(err){
        if(err){expect().fail('error setting emailVerify to false');}
        asyncCallback(err);
      });
    }
    
    // allow visitors to register accounts
    function _setRegisterVisitor(asyncCallback){
      console.log('\nsetting registerAuthority to visitor...');
      handy.system.systemVariable.updateConfig({registerAuthority: 'visitor'}, this.pool, function(err){
        if(err){expect().fail('error setting registerAuthority to visitor');}
        asyncCallback(err);
      });
    }
    
    // create new account
    function _registerUser(asyncCallback){
      this.browser.visit('/login')
      .then((function(){
        console.log('\nvisitor will now try to register...');
        this.browser
        .fill('#userRegister_userEmail', registerUser.email)
        .fill('#userRegister_userPassword', registerUser.password)
        .fill('#userRegister_userPasswordConf', registerUser.password)
        .pressButton('form#userRegister button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\naccount registration should be successful and the user should be logged in.');
            expect(this.browser.document.location.pathname).to.be('/welcomepage');
            asyncCallback(null);              
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can change password _registerUser:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
        return;
      }).bind(this));
    }
    
    function _userLogout(asyncCallback){
      console.log('\nlogging out user...');
      this.browser.visit('/logout')
      .then(function(){
        asyncCallback(null)
      })
      .fail(function(){
        asyncCallback(null);
      });
    }
    
    function _requestPasswordReset(asyncCallback){
      console.log('\nrequesting password reset');
      this.browser.visit('/login')
      .then((function(){
        this.browser
        .fill('#passResetRequest_userEmail', registerUser.email)
        .pressButton('form#passResetRequest button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\npassword reset email requested...');
            expect(this.browser.document.location.pathname).to.be('/login');
            asyncCallback(null);
          }).bind(this));
        }).bind(this))
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can reset password _requestPasswordReset:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
        return;
      }).bind(this));
    }
    
    // simulate click on one-time link and create new password
    function _resetPassword(asyncCallback){
      console.log('\nsetting up one-time link from database...');
      // get one-time link from database
      this.pool.getConnection((function(err, connection){
        if(err){expect().fail('error establishing database pool'); asyncCallback(err); return;}
        var query = 'SELECT onetimelink, onetimelinkhash, onetimelinktimestamp FROM user WHERE email=' + connection.escape(registerUser.email) + ' LIMIT 1';
        connection.query(query, (function(err, results){
          if(err){expect().fail('error executing database query'); asyncCallback(err); return;}
          if(results.length < 1){ expect().fail('newly registered user record not found in database'); asyncCallback(err); return;}
          // recreate registration confirmation link
          var oneTimeLink = baseUrl + '/onetimelogin?email=' + encodeURIComponent(registerUser.email) + '&link=';
          oneTimeLink += encodeURIComponent(results[0].onetimelink);  // add onetime link to url
          
          console.log('\nclicking on one-time link...');
          this.browser.visit(oneTimeLink)
          .then((function(){
            // one-time link should be accepted and the user redirected to enter a new password
            this.browser
            .wait(this._pageLoaded, (function(){
              expect(this.browser.document.location.pathname).to.be('/password/reset');
              this.browser
              .fill('#newPassword', registerUser.newPassword)
              .fill('#newPasswordConf', registerUser.newPassword)
              .pressButton('form#passwordChange button')
              .then((function(){
                return this.browser.wait(this._pageLoaded, (function(){
                  // user should be redirected to their profile page
                  expect(this.browser.document.location.pathname).to.contain('/user');
                  asyncCallback(null);
                }).bind(this));
              }).bind(this));
            }).bind(this));
          }).bind(this))
          .fail((function(){
            console.log('\nerror at Check user can reset password _requestPasswordReset:\n', this.browser.html('div.alert'), err);
            asyncCallback(err);
            return;
          }).bind(this));
        }).bind(this));
      }).bind(this));
    }
    
    function _userLogin(password, expectation, asyncCallback){
      console.log('\nattempting user login...');
      console.log('expectation is ' + expectation);
      this.browser.visit('/login')
      .then((function(){
        this.browser
        .fill('#userLogin_userEmail', registerUser.email)
        .fill('#userLogin_userPassword', password)
        .pressButton('#userLogin button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\ntesting if registered user login is successful...');
            // return test result depending on whether the user login is expected to be successful or fail
            switch (expectation.toLowerCase()){
              case 'succeed':
                expect(this.browser.document.location.pathname).to.be('/welcomepage');
                break;
              case 'failure':
                expect(this.browser.document.location.pathname).not.to.be('/welcomepage');
                break;
            }
            asyncCallback(null);
          }).bind(this));
        }).bind(this))
        .fail((function(){
          return function(){
            // this branch will run because an unverified user trying to login returns a 403 code
            console.log('fail function ran');
            expect(expectation).to.be('failure');
            asyncCallback(null); 
          }
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can reset password _userLogin:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
      }).bind(this));
    }
  });
  
  it.skip('Check user can view profiles', function(done){
    /* Tasks
     * check user can only view profiles they are authorized to see
     * check user can change profile attributes
     */
    
    /* State Dependency
     * App is initialized and configured
     */
    var registerUser = [];
    registerUser[0] = this.createNewRegisterUser();
    registerUser[1] = this.createNewRegisterUser();
    
    var that = this;  // temporary storage for this so it can be passed into async
    
    async.series([
      _setEmailVerifyFalse.bind(that),
      _setRegisterVisitor.bind(that),
      _registerUser.bind(that, 0),
      _userLogout.bind(that),
      _registerUser.bind(that, 1),
      _updateUID.bind(that),
      _viewUserProfile.bind(that, 1, 'succeed'),
      _viewUserProfile.bind(that, 0, 'failure'),
      _userLogout.bind(that)
      ],
      function(err, results){
        console.log('\ncheck user can view profiles test complete');
        done(err);
      }
    );
    
    // remove email verification
    function _setEmailVerifyFalse(asyncCallback){
      console.log('\nsetting emailVerify to false...');
      handy.system.systemVariable.updateConfig({emailVerify: false}, this.pool, function(err){
        if(err){expect().fail('error setting emailVerify to false');}
        asyncCallback(err);
      });
    }
    
    // allow visitors to register accounts
    function _setRegisterVisitor(asyncCallback){
      console.log('\nsetting registerAuthority to visitor...');
      handy.system.systemVariable.updateConfig({registerAuthority: 'visitor'}, this.pool, function(err){
        if(err){expect().fail('error setting registerAuthority to visitor');}
        asyncCallback(err);
      });
    }
    
    // create new account
    function _registerUser(index, asyncCallback){
      this.browser.visit('/login')
      .then((function(){
        console.log('\nvisitor will now try to register...');
        this.browser
        .fill('#userRegister_userEmail', registerUser[index].email)
        .fill('#userRegister_userPassword', registerUser[index].password)
        .fill('#userRegister_userPasswordConf', registerUser[index].password)
        .pressButton('form#userRegister button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\naccount registration should be successful and the user should be logged in...');
            expect(this.browser.document.location.pathname).to.be('/welcomepage');
            asyncCallback(null);              
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can view profiles _registerUser:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
        return;
      }).bind(this));
    }
    
    function _userLogout(asyncCallback){
      console.log('\nlogging out user...');
      this.browser.visit('/logout')
      .fail(function(){
        asyncCallback(null);
      })
      .then(function(){
        asyncCallback(null)
      });
    }
    
    // get user ids from db and attach them to the appropriate user objects
    function _updateUID(asyncCallback){
      console.log('\nnow updating the ids...')
      this.pool.getConnection((function(err, connection){
        if(err){expect().fail('error establishing database pool'); asyncCallback(err); return;}
        // get all email & id pairs for all users
        var query = 'SELECT email, id FROM user';
        connection.query(query, (function(err, results){
          if(err){expect().fail('error reading database'); asyncCallback(err); return;}
          if(results.length < 1){expect().fail('user records not found'); asyncCallback(err); return;}
          
          // associate the email & id pairs to the newly registered users
          registerUser.forEach(function(val_u, key_u){
            results.forEach(function(val_r, key_r){
              if(val_u.email === val_r.email){
                registerUser[key_u].id = val_r.id;
              }
            });
          });
          console.log('\nid update complete...')
          asyncCallback(null);          
        }).bind(this));
      }).bind(this));
    }
    
    // view the user profile
    function _viewUserProfile(index, expectation, asyncCallback){
      // registerUser[1] is logged in at this point, so lets try and see if we can go to their profile
      console.log('\ngoing to user profile...');
      this.browser.visit('/user/' + registerUser[index].id)
      .then((function(){
        var statusCode = this.browser.statusCode;
        switch (expectation.toLowerCase()){
          case 'succeed':
            console.log('\nuser profile loaded. status code is ' + statusCode + '...');
            expect(statusCode).to.be(200);
            break;
          case 'failure':
            console.log('\nuser does not have permission to view this profile...');
            expect(statusCode).to.be(403);  // should return access denied
            asyncCallback(null);
            break; 
        }
        
        console.log('\nchecking if the profile has the correct information...');
        expect(this.browser.window.document.getElementById('userName').value).to.be(registerUser[index].name);
        expect(this.browser.window.document.getElementById('userEmail').value).to.be(registerUser[index].email);
        
        console.log('\nnow try to update profile by changing username...');
        registerUser[index].newName = registerUser[index].name + '_updated';
        this.browser
        .fill('#userName', registerUser[index].newName)
        .pressButton('Update profile')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\nchecking to see if the profile has been updated...');
            expect(this.browser.window.document.getElementById('userName').value).to.be(registerUser[index].newName);
            expect(this.browser.window.document.getElementById('userEmail').value).to.be(registerUser[index].email);
            asyncCallback(null);
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(err){
        console.log('\nerror at Check user can view profiles _viewUserProfile:\n', this.browser.html('div.alert'), err);
        if(expectation.toLowerCase() === 'failure'){
          asyncCallback(null)
        } else {
          asyncCallback(err);
        }
        return;
      }).bind(this))
    }
    
    
  });
  
  it('Check user can cancel account', function(done){
    /* Tasks
     * check user cannot cancel accounts they are not authorized to cancel
     * check user can cancel own account
     */
    
    /* State Dependency
     * App is initialized and configured
     */
    var registerUser = [];
    registerUser[0] = this.createNewRegisterUser();
    registerUser[1] = this.createNewRegisterUser();
    
    var that = this;  // temporary storage for this so it can be passed into async
    
    async.series([
      _setEmailVerifyFalse.bind(that),
      _setRegisterVisitor.bind(that),
      _registerUser.bind(that, 0),
      _userLogout.bind(that),
      _registerUser.bind(that, 1),
      _updateUID.bind(that),
      _cancelUserAccount.bind(that, 0, 'failure'),
      _cancelUserAccount.bind(that, 1, 'succeed'),
      _userLogout.bind(that)
      ],
      function(err, results){
        console.log('\ncheck user can cancel account test complete');
        done(err);
      }
    );
    
    // remove email verification
    function _setEmailVerifyFalse(asyncCallback){
      console.log('\nsetting emailVerify to false...');
      handy.system.systemVariable.updateConfig({emailVerify: false}, this.pool, function(err){
        if(err){expect().fail('error setting emailVerify to false');}
        asyncCallback(err);
      });
    }
    
    // allow visitors to register accounts
    function _setRegisterVisitor(asyncCallback){
      console.log('\nsetting registerAuthority to visitor...');
      handy.system.systemVariable.updateConfig({registerAuthority: 'visitor'}, this.pool, function(err){
        if(err){expect().fail('error setting registerAuthority to visitor');}
        asyncCallback(err);
      });
    }
    
    // create new account
    function _registerUser(index, asyncCallback){
      this.browser.visit('/login')
      .then((function(){
        console.log('\nvisitor will now try to register...');
        this.browser
        .fill('#userRegister_userEmail', registerUser[index].email)
        .fill('#userRegister_userPassword', registerUser[index].password)
        .fill('#userRegister_userPasswordConf', registerUser[index].password)
        .pressButton('form#userRegister button')
        .then((function(){
          return this.browser.wait(this._pageLoaded, (function(){
            console.log('\naccount registration should be successful and the user should be logged in...');
            expect(this.browser.document.location.pathname).to.be('/welcomepage');
            asyncCallback(null);              
          }).bind(this));
        }).bind(this));
      }).bind(this))
      .fail((function(){
        console.log('\nerror at Check user can view profiles _registerUser:\n', this.browser.html('div.alert'), err);
        asyncCallback(err);
        return;
      }).bind(this));
    }
    
    function _userLogout(asyncCallback){
      console.log('\nlogging out user...');
      this.browser.visit('/logout')
      .fail(function(){
        asyncCallback(null);
      })
      .then(function(){
        asyncCallback(null)
      });
    }
    
    // get user ids from db and attach them to the appropriate user objects
    function _updateUID(asyncCallback){
      console.log('\nnow updating the ids...')
      this.pool.getConnection((function(err, connection){
        if(err){expect().fail('error establishing database pool'); asyncCallback(err); return;}
        // get all email & id pairs for all users
        var query = 'SELECT email, id FROM user';
        connection.query(query, (function(err, results){
          if(err){expect().fail('error reading database'); asyncCallback(err); return;}
          if(results.length < 1){expect().fail('user records not found'); asyncCallback(err); return;}
          // associate the email & id pairs to the newly registered users
          registerUser.forEach(function(val_u, key_u){
            results.forEach(function(val_r, key_r){
              if(val_u.email === val_r.email){
                registerUser[key_u].id = val_r.id;
              }
            });
          });
          console.log('\nid update complete...')
          asyncCallback(null);          
        }).bind(this));
      }).bind(this));
    }
    
    // cancel user account
    function _cancelUserAccount(index, expectation, asyncCallback){
      console.log('\nstarting cancelling user account...')
      this.browser.visit('/cancelaccount/' + registerUser[index].id)
      .then((function(){
        switch (expectation){
          case 'succeed':
            // should display account cancellation confirmation page
            expect(this.browser.statusCode).to.be(200);
            console.log('\nrequesting confirmation to cancel account...\nproceeding with confirmation');
            this.browser
            .pressButton('Cancel this account')
            .then((function(){
              // user should be logged out since they are cancelling their own account
              console.log('\nchecking if user is logged out');
              expect(this.browser.document.location.pathname).to.be('/');
              console.log('\nchecking if user account has been cancelled');
              this.pool.getConnection((function(err, connection){
                if(err){return asyncCallback(err);}
                var query = 'SELECT deleted FROM user WHERE id=' + connection.escape(registerUser[index].id);
                connection.query(query, (function(err, results){
                  if(err){return asyncCallback(err);}
                  // return error if no results are found in database
                  if(results.length < 1){
                    var dbError = new Error('user record not found.  could not check if the user has been deleted');
                    return asyncCallback(dbError);
                  }
                  expect(results[0].deleted).to.eql(true);
                  asyncCallback(null);
                }).bind(this));
              }).bind(this));
            }).bind(this));
            break;
          case 'failure':
            // should display access denied page
            expect(this.browser.statusCode).to.be(403);
            console.log('\naccess denied to cancel this account...');
            asyncCallback(null);
            break;
        }
      }).bind(this))
      .fail((function(err){
        if (expectation === 'failure'){
          console.log('\ncancel account failed as expected...');
          asyncCallback(null);
        } else {
          console.log('\nunexpected error cancelling the account\n', err);
          asyncCallback(err);
        }
      }).bind(this))
    }
  });
  
});


















