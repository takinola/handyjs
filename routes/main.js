/*
 * Routes for generic pages e.g. home, about, welcome, etc
 */
'use strict';

var _ = require('underscore')
  , async = require('async')
  , handy = require('../../handy/lib/handy').get('handy')
  , url = require('url')
  , express = require('express')
  ;

module.exports = function(app){

  // set up routers
  var configurationR = express.Router();
  var userR = express.Router();
  var storyR = express.Router();
  var commentR = express.Router();
  var categoryR = express.Router();
  let contentR = express.Router();


  /**************************************************************************************************
   **************************************************************************************************
   ****************************       Site management routes       **********************************
   **************************************************************************************************
   *************************************************************************************************/
  
  // test page: for running various experiments
  app.get('/testpage', handy.user.checkPermission('system.System', ['Can run tests']), function(req, res, next){
    handy.system.prepGetRequest({
      info: {title: 'Test scenarios'},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'testpage - prepGetRequest'}); return;}

      res.send(handy.utility.generateRandomString(20));
      const pool = handy.system.systemVariable.get('pool');
      pool.getConnection(function(err, connection){
        let query = 'SELECT organization FROM user; SELECT id FROM user';
        connection.query(query, function(err, results){
          console.log(err, results);
        });
      });

    });
    
  });
  
  // test page: for running unauthenticated various experiments
  app.get('/testpageunauth', handy.user.requireAuthenticationStatus('unauthenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Test scenarios'},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'test',}); return;}
      
      url.resolve('/testpageunauth', '/crazypage.html');

      var logDetail = {type: 'info', category: 'system', message: 'display testpageunauth page'};
      handy.system.display(req, res, 'testpage', pageInfo, logDetail);
    });
  });
  
  // Handy installation page
  app.get('/install', function(req, res){
    // default information
    var pageInfo = {
      title: 'Handy Installation Guide',
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query, url: req.url},
      other: {}
    };

    // only allow installation if not previously done
    if(!handy.system.systemVariable.get('installation_flag')){
      var logDetail = {type: 'info', category: 'system', message: 'display installation page'};
      handy.system.display(req, res, 'install', pageInfo, logDetail);
    } else {
      handy.system.logger.record('info', {req: req, category: 'system', message: 'installation complete'});
      res.redirect('/');
      return;
    }
  });

  /* Welcome page
   * first page seen by logged in users (as opposed to home page which is the first page not logged in users see)
   */
  app.get('/welcomepage', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Welcome | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'welcomepage - error in prepGetRequest'}); return;}
      var welcomepage = handy.system.systemVariable.getConfig('welcomePage');
      if(welcomepage === '' || welcomepage === null || welcomepage === '/welcomepage'){
        var logDetail = {type: 'info', category: 'system', message: 'display welcome page'};
        handy.system.display(req, res, 'index', pageInfo, logDetail);
        return;
      } else {
        // restore the system messages before redirect.  This is required if redirecting after doing a prepGetRequest
        // because prepGetRequest moves the messages to the res object, which then gets wiped out after a redirect
        handy.system.restoreSystemMessage(req, res);
        res.redirect(welcomepage);
        return;
      }
    });
  });

  // main configuration page
  configurationR.get('/', handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Site configuration links | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.System.logger.record('error', {error: err, message: 'configuration - error in prepGetRequest'}); return;}

      var logDetail = {type: 'info', category: 'system', message: 'display configuration directory page'};
      handy.system.display(req, res, 'configuration', pageInfo, logDetail);
    });
  });

  // general site configuration page
  configurationR.get('/general', handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){

    // otherwise, continue preparing the configuration page
    handy.system.prepGetRequest({
      info: {title: 'Site configuration | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'configuration general - error in prepGetRequest'}); return;}
      
      var asyncFn = {
        accountpendingregistration: _getAccountsPendingRegistration,
        existingRoleList: _getListOfRoles,
        sitemapSettings: _getSitemapSettings
      };

      async.parallel(asyncFn, function(err, results){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Something went wrong: ' + err.message);
          handy.system.redirectBack(0, req, res);  // redirect to current page
          handy.system.logger.record('error', {error: err, message: 'configuration - error displaying configuration'});
          return;
        }
      
        pageInfo.other = results;
        pageInfo.other.sitemapSubmit = handy.system.systemVariable.getConfig('sitemapSubmit');
        pageInfo.other.cronPath = handy.system.systemVariable.getConfig('cronRecord').path;
        pageInfo.other.robotsTxt = handy.system.systemVariable.getConfig('robotsTxt');

        var logDetail = {type: 'info', category: 'system', message: 'display configuration page'};
        handy.system.display(req, res, 'configgeneral', pageInfo, logDetail);
        return;
      });
    
      // get accounts pending registration i.e verified = false;
      function _getAccountsPendingRegistration(asyncCallback){
        var pool = handy.system.systemVariable.get('pool');
        pool.getConnection(function(err, connection){
          if(err){
            asyncCallback(err);
          } else {
            var query = 'SELECT id, name, email, createdate FROM user WHERE verified=false';
            connection.query(query, function(err, results){
              if(err){
                asyncCallback(err);
              } else {
                if(results.length > 0){
                  asyncCallback(null, results);
                } else {
                  asyncCallback(null, []);
                }
              }
            });
          }
        });
      }
    
      // get list of roles
      function _getListOfRoles(asyncCallback){
        /* the list of roles should be derived from the system configuration and not memory
         * because there can be cases where the system configuration has more complete
         * information e.g. if there is a role that does not have any user assigned to it
         * it will not exist in memory but will be recorded in system configuration
         */
        var rpg = handy.system.systemVariable.getConfig('rolesPermissionGrant');
        var roles = Object.keys(rpg);
        asyncCallback(null, roles);
      }
    
      // get list of content types
      function _getSitemapSettings(asyncCallback){
        // get list of all content types in the system for the sitemap
        var sitemapSettings = handy.system.systemVariable.getConfig('sitemapConfig');
        asyncCallback(null, sitemapSettings);
      }
    });
  });

  // access control configuration page
  configurationR.get('/permissions', handy.user.checkPermission('system.System', ['can alter system configuration']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Update role permissions | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'permissions - error in prepGetRequest'}); return;}

      // get the resource and permissions lists
      pageInfo.other.resourcePermissionList = handy.system.systemVariable.getConfig('resourcePermissionList');
      pageInfo.other.rolesPermissionGrant = handy.system.systemVariable.getConfig('rolesPermissionGrant');

      var logDetail = {type: 'info', category: 'system', message: 'display permissions page'};
      handy.system.display(req, res, 'permissions', pageInfo, logDetail);
      return;
    });
  });


  // theme configuration page
  configurationR.get('/theme', handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){
    // otherwise, continue preparing the theme page
    handy.system.prepGetRequest({
      info: {title: 'Site theme settings | ' + handy.system.systemVariable.getConfig('siteName'), 
             description: 'Modify global theme settings | ' + handy.system.systemVariable.getConfig('siteName'),
            },
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'theme - error in prepGetRequest'}); return;}

      var logDetail = {type: 'info', category: 'system', message: 'display theme page'};
      handy.system.display(req, res, 'theme', pageInfo, logDetail);
      return;
    });
  });


  app.use('/configuration', configurationR);

  // Access denied page
  app.get('/accessdenied', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Access denied | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'access denied page - error in prepGetRequest'}); return;}
      
      res.statusCode = 403;
      var accessdeniedpage = handy.system.systemVariable.getConfig('default403Page');
      if(accessdeniedpage === '' || accessdeniedpage === null || accessdeniedpage === '/accessdenied'){
      
        var logDetail = {type: 'warn', category: 'system', message: '403 access denied'};
        handy.system.display(req, res, '403accessdenied', pageInfo, logDetail);
        return;
      } else {
        // restore the system messages before redirect.  This is required if redirecting after doing a prepGetRequest
        // because prepGetRequest moves the messages to the res object, which then gets wiped out after a redirect
        handy.system.restoreSystemMessage(req, res);
        res.redirect(res.statusCode, accessdeniedpage);
        handy.system.logger.record('warn', {req: req, category: 'system', message: '403 access denied'});
        return;
      }
    });
  });

  // 404 not found page
  app.get('/notfound', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Page not found (404) | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'not found page - error in prepGetRequest'}); return;}
      
      res.statusCode = 404;
      var notfoundpage = handy.system.systemVariable.getConfig('default404Page');
      if(notfoundpage === '' || notfoundpage === null || notfoundpage === '/notfound'){

        handy.system.display(req, res, '404notfound', pageInfo);
        return;
      } else {
        // restore the system messages before redirect.  This is required if redirecting after doing a prepGetRequest
        // because prepGetRequest moves the messages to the res object, which then gets wiped out after a redirect
        handy.system.restoreSystemMessage(req, res); 
        res.redirect(res.statusCode, notfoundpage);
        return;
      }
    });
  });

  // Internal error page
  app.get('/internalerror', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Internal Error | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'internal error page - error in prepGetRequest'}); return;}
      
      res.statusCode = 500;
      var logDetail = {type: 'warn', category: 'system', message: '500 internal error'};
      handy.system.display(req, res, '500internalerror', pageInfo, logDetail);
      return;
    });
  });
  
  // run cron
  app.get('/cron/:path', function(req, res){
    var path = encodeURIComponent(req.params.path);  //  undo decodeURIComponent automatically applied by req.params
    var cronPath = handy.system.systemVariable.getConfig('cronRecord').path;
    if(path !== cronPath){return res.redirect('/');}  // wrong path parameter, don't run cron

    // run cron
    handy.system.runCron(req, res, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', err.message);
        handy.system.logger.record('error', {error: err, message: 'cron ended with errors'});
      } else {
        handy.system.systemMessage.set(req, 'success', 'cron ran successfully');
        handy.system.logger.record('info', {req: req, category: 'cron', message: 'cron run successfully'});
      }
      return res.redirect('/');
    });
  });
  
  // XML sitemap
  app.get('/sitemap.xml', handy.system.recordUrlHistory(), function(req, res){
    // get all content urls
    var alias = handy.system.systemVariable.getConfig('alias');

    // get sitemap configuration
    var sitemapConfig = handy.system.systemVariable.getConfig('sitemapConfig');
    
    // get base url
    var baseUrl = req.protocol + '://' + req.hostname;
    
    var xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    _.forEach(alias, function(val, key){

      var contentType = val.type;
      // since we are not sure what case the keys of sitemapConfig.content are, we need to do a lowercase compare
      var freq
        , priority
        ;

      _.forEach(sitemapConfig.content, function(obj, type){
        if(type.toLowerCase() === contentType.toLowerCase()){
          freq = obj.freq || sitemapConfig.default.freq;
          priority = obj.priority || sitemapConfig.default.priority;
        }
      });
      
      xml += '<url>';
      xml += '<loc>'+ baseUrl + val.url + '</loc>';
      xml += '<changefreq>'+ freq +'</changefreq>';
      xml += '<priority>'+ priority +'</priority>';
      xml += '</url>';
    });
    
    xml += '</urlset>';

    res.header('Content-Type', 'text/xml');
    res.send(xml);
  });


  // robots.txt
  app.get('/robots.txt', handy.system.recordUrlHistory(), function(req, res){
    var robots = handy.system.systemVariable.getConfig('robotsTxt') || '';
    res.header('Content-Type', 'text/plain');
    res.send(robots);
  });
  
  // contact form
  app.get('/contact', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Contact form | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'contact page - error in prepGetRequest'}); return;}

      var logDetail = {type: 'info', category: 'system', message: 'display contact page'};
      handy.system.display(req, res, 'contactform', pageInfo, logDetail);
    });
  });
  
  
  /**************************************************************************************************
   **************************************************************************************************
   ****************************       User management routes       **********************************
   **************************************************************************************************
   *************************************************************************************************/
  
  // Login page
  app.get('/login', handy.user.requireAuthenticationStatus('unauthenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Login | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'login page - error in prepGetRequest'}); return;}
      
      // set post login/registration destination
      if(req.query.destination){
        pageInfo.other.destination = encodeURIComponent(req.query.destination).replace(/%20/g, '+');
      }

      var logDetail = {type: 'info', category: 'system', message: 'display login page'};
      handy.system.display(req, res, 'login', pageInfo, logDetail);
    });
  });
  

  // Organization admin registration page
  app.get('/organization/register', handy.user.requireAuthenticationStatus('unauthenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Register new organization | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'organization registration page - error in prepGetRequest'}); return;}
      
      // set post login/registration destination
      if(req.query.destination){
        pageInfo.other.destination = encodeURIComponent(req.query.destination).replace(/%20/g, '+');
      }

      var logDetail = {type: 'info', category: 'system', message: 'display organization registration page'};
      handy.system.display(req, res, 'orgregistration', pageInfo, logDetail);
    });
  });


  // Organization user management page
  app.get('/organization/manage', handy.user.requireAuthenticationStatus('authenticated'), handy.user.checkPermission('user.User', ["can modify other users' accounts"]), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Manage user accounts for your organization | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'organization management page - error in prepGetRequest'}); return;}
      
      // get list of users in this organization
      _findOrganizationUsers(req)
      .then(function(list){
        pageInfo.other.orgusers = list;
        let logDetail = {type: 'info', category: 'system', message: 'display organization management page'};
        handy.system.display(req, res, 'orgmanagement', pageInfo, logDetail);
      })
      .catch(function(err){
        handy.system.systemMessage.set(req, 'danger', 'Something went wrong: ' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to current page
        handy.system.logger.record('error', {error: err, message: 'organization management page - error displaying'});
        return;
      });

      // find all users who share the same organization as the current user
      function _findOrganizationUsers(req){
        return new Promise(function(resolve, reject){
          let organization = req.session.user.organization;
          const pool = handy.system.systemVariable.get('pool');
          pool.getConnection(function(err, connection){
            if(err){ return reject(err); }
            let query = 'SELECT id, name, email, createdate, lastlogin, deleted FROM user ';
            query += 'WHERE organization = ' + connection.escape(organization);
            connection.query(query, function(err, results){
              let list = [];
              if(err){ return reject(err); }
              // remove current user from list
              results.forEach(function(user){
                req.session.user.id !== parseInt(user.id) ? list.push(user) : null;
              });

              return resolve(list);
            });
          });
        });
      }
    });
  });


  // logout page
  app.get('/logout', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    var pageInfo = {
      title: null,
      config: handy.system.systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query},
      googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
      other: {}
    };

    var logoutuser = new handy.user.User();
    logoutuser.cloneObject(req.session.user);

    logoutuser.logout(req, function(){
      logoutuser = null;  // free up some memory
      res.redirect('/');
      handy.system.logger.record('info', {req: req, category: 'user', message: 'user logout'});
      return;
    });
  });

  
  /********************************** 
    * DISPLAY user account profile *
  ***********************************/
  userR.get('/:uid?', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'user profile page - error in prepGetRequest'}); return;}
      
      req.params.uid = req.params.uid || req.session.user.id;  // default to current user
      var uid = parseInt(req.params.uid);  // params are strings so first convert to integer
      // check that uid is a number, if not, send 404
      if(_.isNaN(uid)){
        handy.system.systemMessage.set(req, 'danger', 'User not found!');
        res.status = 404;
        res.redirect('/notfound');
        handy.system.logger.record('warn', {req: req, category: 'user', message: 'user profile ' + uid + ' not found'});
        return;
      }
    
      // process differently, if the user is accessing their own profile or another's
      var ownAccount = req.session.user.id === uid ? true : false;
      var logDetail;  // will contain the information sent to the log record
      switch(ownAccount){
        case true:
          var requestedUser = new handy.user.User();
          requestedUser.load(req.session.user.id, 'id', function(err){
            if(err){
              handy.system.systemMessage.set(req, 'danger', err.message);
              res.status = 404;
              res.redirect('/notfound');
              handy.system.logger.record('warn', {error: err, message: 'user profile not found: id: ' + requestedUser.id})
              requestedUser = null;  // free up memory
              return;
            }
          
            requestedUser.authenticated = true;
            pageInfo.title = 'User profile: ' + req.params.uid;
            handy.system.getOrganizationName(this.organization, (function(organizationName){
              this.organizationName = organizationName;
              pageInfo.user = this;
              logDetail = {type: 'info', category: 'user', message: 'user profile ' + uid + ' displayed'};
              handy.system.display(req, res, 'userprofile', pageInfo, logDetail);
              requestedUser = null;  // free up memory
              return;
            }).bind(this));
          }.bind(requestedUser));
          break;
        case false:
          // check if requesting user has the right permissions to view another users profile
          handy.user.checkPermission(req.session.user.id, 'user.User', ["can modify other users' accounts"], function(err, approved){
            if(err || !approved){
              handy.system.systemMessage.set(req, 'danger', 'You do not have permission to edit that user profile');
              res.redirect('/accessdenied');
              handy.system.logger.record('warn', {req: req, category: 'user', message: 'access denied to user profile '});
              return;
            }

            // user has the right permissions, so we can proceed...          
            // ...so load requested user record from database
            var requestedUser = new handy.user.User();
            requestedUser.load(uid, 'id', (function(err){
              if(err){
                handy.system.systemMessage.set(req, 'danger', err.message);
                res.status = 404;
                res.redirect('/notfound');
                handy.system.logger.record('error', {error: err, message: 'user profile not found. id: ' + requestedUser.id});
                requestedUser = null;  // free up memory 
                return;
              } 
            
              // render profile of requested user
              pageInfo.title = 'User profile: ' + uid;
              pageInfo.user = this
              logDetail = {type: 'info', category: 'user', message: 'user profile ' + uid + ' displayed'};
              handy.system.display(req, res, 'userprofile', pageInfo, logDetail);
              requestedUser = null;  // free up memory
              return;
            }).bind(requestedUser));
          })(req, res);
          break;
        }
    });
  });


  /********************************** 
      * PASSWORD change or reset *
  ***********************************/
  userR.get('/:uid/password/:action', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    /* action can be either "change" or "reset"
     * "change" means the user has to supply the old password
     * "reset" means the user does not have to supply the old password (because they forgot it or something).
     * The user needs to be authenticated in both scenarios because 
     *   "change" scenario - obvious since only authenticated users can change their passwords
     *   "reset" scenario - if a user requests a password reset, they are sent a one-time link.  When this link
         is clicked, they are logged in but need to create a new password (since the old one has been reset.
     */
    handy.system.prepGetRequest({
      info: {title: 'Change your password | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'password reset page - error in prepGetRequest'}); return;}
      
      pageInfo.other.type = req.params.action;
      var logDetail = {type: 'info', category: 'user', message: 'display password change page'};
      handy.system.display(req, res, 'passwordchange', pageInfo, logDetail);
      return;
    });
  });


  /************************************
           * CANCEL account *
  *************************************/
  userR.get('/:id/account/cancel', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){

    handy.system.prepGetRequest({
      info: {title: 'Cancel user account | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'account cancel page - error in prepGetRequest'}); return;}
      
      // set uid to current user id, if uid is not supplied
      var uid = typeof req.params.uid !== 'undefined' ? parseInt(req.params.uid) : req.session.user.id

      // check if user is cancelling own account or someone elses
      var ownaccount = pageInfo.user.id === uid ? true : false;
      var logDetail;  // will contain information sent to the log record
      switch (ownaccount){
        case true:
          // user is cancelling their own account so go ahead
          pageInfo.other.cancelUser = [{id: uid, name: pageInfo.user.name, email: pageInfo.user.email, createdate: pageInfo.user.createdate.toString()}];
          
          logDetail = {type: 'info', category: 'user', message: 'display account cancellation form. user: ' + uid};
          handy.system.display(req, res, 'cancelaccount', pageInfo, logDetail);
          return;
          break;
        case false:
          // user is cancelling someone else's account so check if they have the appropriate permission
          handy.user.checkPermission('user.User', ["can modify other users' accounts"], function(err, approved){
            if(err || !approved){
              handy.system.systemMessage.set(req, 'danger', 'You do not have permission to cancel that user account');
              res.redirect('/accessdenied');
              handy.system.logger.record('warn', {req: req, error: err, message: 'error or permission denied to cancel user account: ' + uid});
              return;
            }

            // executing user has the appropriate permissions
            var cancelUser = new handy.user.User();
            cancelUser.id = uid;
            cancelUser.load(cancelUser.id, 'id', (function(err){
              if(err){
                handy.system.systemMessage.set(req, 'danger', 'Error locating user account');
                res.redirect('/notfound');
                handy.system.logger.record('error', {error: err, message: 'user account to be canceled can not be found. id: ' + cancelUser.id});
                cancelUser = null;  // free up memory
                return;
              }
              pageInfo.other.cancelUser = [{id: this.id, name: this.name, email: this.email, createdate: this.createdate.toString()}];
              logDetail = {type: 'info', category: 'user', message: 'display account cancellation form. user: ' + uid};
              handy.system.display(req, res, 'cancelaccount', pageInfo, logDetail);
              cancelUser = null;  // free up memory
              return;
            }).bind(cancelUser));
          })(req, res);
          break;
        }
    });
  });

  app.use('/user', userR);
  
  
  /**************************************************************************************************
   **************************************************************************************************
   ****************************       Content management routes       **********************************
   **************************************************************************************************
   *************************************************************************************************/
  
  contentR.get('/create/:type', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Create new ' + req.params.type + ' | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'content creation page - error in prepGetRequest'}); return;}
      
      // get list of all content types in the system
      let contentTypeList = handy.system.systemVariable.getConfig('contentTypeList');
      contentTypeList = Object.keys(contentTypeList);
    
      pageInfo.other.contentTypeList = contentTypeList;
      pageInfo.other.contentType = req.params.type;

      let categoryList = handy.system.systemVariable.getConfig('categoryList');
      pageInfo.other.categoryDefault = {id: null, name: null, parent: null};
      pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');
    
      pageInfo.other.action = 'create';

      let logDetail = {type: 'info', category: 'system', message: 'display content creation page'};
      handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
      return;
    });
  });

  // redirect aliases to real content
  contentR.get('/:id', function(req, res){
    // find corresponding content
    let content = handy.content.findContentFromAlias(req.params.id);
    let contentUrl  = content.url !== null ? content.url : '/notfound';
    res.redirect(contentUrl);
  });

  contentR.get('/:id/:action', function(req, res){
    // find corresponding content
    let content = handy.content.findContentFromAlias(req.params.id);
    let contentUrl  = content.url !== null ? content.url + '/' + req.params.action : '/notfound';

    res.redirect(contentUrl);
  });

  app.use('/content', contentR);

  storyR.get('/:id', handy.user.checkPermission('content.Story', ['Can view content']), function(req, res){
    let contentType = 'story';

    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: contentType + ' display page - error in prepGetRequest'}); return;}

      // get content from cache
      let story = new handy.content.Story();

      pageInfo.siteinfo.path = '/' + contentType + pageInfo.siteinfo.path; // add back the mount point to the path

      story.load(pageInfo.siteinfo.path, 'url', (function(err, result){
        if(err){
          story = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for display'}); 
          return _endProcessingWithFail(err, req, res, 1);
        }
        
        pageInfo.other.destination = encodeURIComponent(pageInfo.siteinfo.path);

        pageInfo.title = _.escape(this.title).substr(0, 40) + ' | ' + handy.system.systemVariable.getConfig('siteName');
        pageInfo.description = _.escape(this.title) + '. ' + _.escape(this.body.substr(0,130));
        pageInfo.canonical = req.protocol + '://' + req.hostname + this.url;
        pageInfo.other.storyValue = {};
        pageInfo.other.storyValue.title = _.escape(this.title);
        pageInfo.other.storyValue.link = this.link;
        pageInfo.other.storyValue.body = this.body;
        pageInfo.other.storyValue.contentid = this.contentid;
      
        // check if content is published or deleted
        !this.published ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' is not published') : null;
        this.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
        if(!this.published || this.deleted){
          // redirect to previous page (not current page).  This is because of the situation
          // where a user edits a page and sets it to 'unpublished'.  in this
          // situation, the current page would be a redirect back to itself which
          // would be an infinite loop
          handy.system.redirectBack(1, req, res);
          story = null;
          handy.system.logger.record('warn', {req: req, category: 'content', message: contentType +  ' not displayed because not published or deleted. id: ' + this.id});
          return;
        }
      
        // get comments
        pageInfo.other.comments = {};
        this.getRelatedContent('comment', (function(err, commentList){
          if(err){
            pageInfo.other.comments = {0:{text: 'comments could not be retrieved at this time', creator: null}};
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error getting related comments for ' + contentType + '. id: ' + this.id});
          } else {
            commentList.forEach(function(comm, commId){
              pageInfo.other.comments[commId] = {text: _.escape(comm.comment.body).replace(/\r?\n/g, '<br/>'), creator: comm.user.name};
            });
          }

          // check if user has rights to edit this content (used to decide to display the edit/delete link next to the content)
          let uid = parseInt(req.session.user.id);
          handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, this.id, 'id', 'edit', (function(err, result){
            if(err || !result){
              pageInfo.other.displayEditLink = false;
            } else {
              pageInfo.other.displayEditLink = true;
            }

            var logDetail = {type: 'info', category: 'content', message: contentType + ' displayed. id: ' + this.id};
            handy.system.display(req, res, 'story', pageInfo, logDetail);
            story = null; // free up memory
            return;
          }).bind(this));
        }).bind(this));
      }).bind(story));
    });
  });

  storyR.get('/:id/edit', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      let contentType = 'story';
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: contentType + ' edit page - error in prepGetRequest'}); return;}
      
      let uid = parseInt(req.session.user.id);
      let url = '/' + contentType + '/' + encodeURIComponent(req.params.id);
      
      // get content from database / cache
      let story = new handy.content.Story();
      story.load(url, 'url', (function(err){
        let contentId = this.id;
        let contentIdType = 'id';

        if(err){
          story = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for editing. id: ' + this.id}); 
          return _endProcessingWithFail(err, req, res, 1);
        }

        // check if the user has the permission to edit this content (ie general editing permission for this type of content or editing own content)
        handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, contentId, contentIdType, 'edit', (function(err, flag){
          if(err){
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for display. id: ' + this.id}); 
            return _endProcessingWithFail(err, req, res, 1);
          }
          if(!flag){
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied to open ' + contentType + ' for editing. id: ' + this.id});
            return _endProcessingWithFail(null, req, res, 1);
          }

          // check if content is deleted
          if(this.deleted){
            handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted');
            handy.system.redirectBack(1, req, res);
            story = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: contentType + ' can not be edited. id: ' + this.id});
            return;
          }

          pageInfo.title = 'Editing ' + contentType + ' - ' + this.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = this.title;
          pageInfo.other.defaultValue.bodyValue = this.body;
          pageInfo.other.defaultValue.urlValue = this.url;
          pageInfo.other.defaultValue.categoryValue = parseInt(this.category);
          pageInfo.other.defaultValue.publishValue = this.published;
          pageInfo.other.contentId = this.id;
          pageInfo.other.action = 'edit';
          pageInfo.other.contentType = contentType;

          let categoryId = this.category === null ? null : parseInt(this.category);
          let categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');

          let logDetail = {type: 'info', category: 'content', message: contentType + ' opened for editing. id: ' + this.id};
          handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
          story = null; // free up memory
        }).bind(this));
      }).bind(story));
    });
  });

  storyR.get('/:id/delete', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      let contentType = 'story';
      let uid = parseInt(req.session.user.id);
      let url = '/' + contentType + '/' + encodeURIComponent(req.params.id);

      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: contentType + ' deletion page - error in prepGetRequest'}); return; }

      // get content from database
      let story = new handy.content.Story();
      story.load(url, 'url', (function(err){
        if(err){
          story = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for deletion'}); 
          return _endProcessingWithFail(err, req, res, 1);
        }

        // check if user has the permissions to delete this content
        handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, this.id, 'id', 'delete', (function(err, result){
          if(err){
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error checking user permission to delete ' + contentType});
            return _endProcessingWithFail(err, req, res, 1);
          }
          if(!result){
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. ' + contentType + ' can not be opened for deletion. id: ' + this.id});
            return _endProcessingWithFail(null, req, res, 1);
          }

          // check if content is deleted
          this.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(this.deleted){
            handy.system.redirectBack(1, req, res);
            story = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: contentType + ' already deleted. ' + contentType + ' can not be opened for deletion. id: ' + this.id});
            return;
          }

          pageInfo.title = 'Delete ' + contentType + ' - ' + this.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = this.title;
          pageInfo.other.defaultValue.bodyValue = this.body;
          pageInfo.other.defaultValue.urlValue = this.url;
          pageInfo.other.defaultValue.publishValue = this.published;
          pageInfo.other.contentId = this.id;
          pageInfo.other.contentType = contentType;
          pageInfo.other.action = 'delete';

          let categoryId = this.category === null ? null : parseInt(this.category);
          let categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');

          let logDetail = {type: 'info', category: 'content', message: contentType + ' opened for deletion. id: ' + this.id};
          handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
          story = null; // free up memory
          return;
        }).bind(this));
      }).bind(story));
    });
  });

  app.use('/story', storyR);
  

  commentR.get('/:id', handy.user.checkPermission('content.Comment', ['Can view content']), function(req, res){
    let contentType = 'comment';

    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: contentType + ' display page - error in prepGetRequest'}); return;}

      // get content from cache
      let comment = new handy.content.Comment();

      pageInfo.siteinfo.path = '/' + contentType + pageInfo.siteinfo.path; // add back the mount point to the path

      comment.load(pageInfo.siteinfo.path, 'url', (function(err, result){
        if(err){
          comment = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for display'}); 
          return _endProcessingWithFail(err, req, res, 1);
        }
        
        pageInfo.other.destination = encodeURIComponent(pageInfo.siteinfo.path);

        pageInfo.title = _.escape(this.title).substr(0, 40) + ' | ' + handy.system.systemVariable.getConfig('siteName');
        pageInfo.description = _.escape(this.title) + '. ' + _.escape(this.body.substr(0,130));
        pageInfo.canonical = req.protocol + '://' + req.hostname + this.url;
        pageInfo.other.commentValue = {};
        pageInfo.other.commentValue.title = _.escape(this.title);
        pageInfo.other.commentValue.link = this.link;
        pageInfo.other.commentValue.body = this.body;
        pageInfo.other.commentValue.contentid = this.contentid;
      
        // check if content is published or deleted
        !this.published ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' is not published') : null;
        this.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
        if(!this.published || this.deleted){
          handy.system.redirectBack(1, req, res);
          comment = null;
          handy.system.logger.record('warn', {req: req, category: 'content', message: contentType +  ' not displayed because not published or deleted. id: ' + this.id});
          return;
        }
      
        // check if user has rights to edit this content (used to decide to display the edit/delete link next to the content)
        let uid = parseInt(req.session.user.id);
        handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, this.id, 'id', 'edit', (function(err, result){
          if(err || !result){
            pageInfo.other.displayEditLink = false;
          } else {
            pageInfo.other.displayEditLink = true;
          }

          let logDetail = {type: 'info', category: 'content', message: contentType + ' displayed. id: ' + this.id};
          handy.system.display(req, res, 'comment', pageInfo, logDetail);
          comment = null; // free up memory
          return;
        }).bind(this));
      }).bind(comment));
    });
  });

  commentR.get('/:id/edit', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      let contentType = 'comment';
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: contentType + ' edit page - error in prepGetRequest'}); return;}
      
      let uid = parseInt(req.session.user.id);
      let url = '/' + contentType + '/' + encodeURIComponent(req.params.id);

      // get content from database / cache
      let comment = new handy.content.Comment();
      comment.load(url, 'url', (function(err){
        let contentId = this.id;
        let contentIdType = 'id';

        if(err){
          comment = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for editing. id: ' + this.id}); 
          return _endProcessingWithFail(err, req, res, 1);
        }

        // check if the user has the permission to edit this content (ie general editing permission for this type of content or editing own content)
        handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, contentId, contentIdType, 'edit', (function(err, flag){
          if(err){
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for display. id: ' + this.id}); 
            return _endProcessingWithFail(err, req, res, 1);
          }
          if(!flag){
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied to open ' + contentType + ' for editing. id: ' + this.id});
            return _endProcessingWithFail(null, req, res, 1);
          }

          // check if content is deleted
          if(this.deleted){
            handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted');
            handy.system.redirectBack(1, req, res);
            comment = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: contentType + ' can not be edited. id: ' + this.id});
            return;
          }

          pageInfo.title = 'Editing ' + contentType + ' - ' + this.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = this.title;
          pageInfo.other.defaultValue.bodyValue = this.body;
          pageInfo.other.defaultValue.urlValue = this.url;
          pageInfo.other.defaultValue.categoryValue = parseInt(this.category);
          pageInfo.other.defaultValue.publishValue = this.published;

          pageInfo.other.contentId = this.id;
          pageInfo.other.action = 'edit';
          pageInfo.other.contentType = contentType;

          let categoryId = this.category === null ? null : parseInt(this.category);
          let categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');

          let logDetail = {type: 'info', category: 'content', message: contentType + ' opened for editing. id: ' + this.id};
          handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
          comment = null; // free up memory
        }).bind(this));
      }).bind(comment));
    });
  });

  commentR.get('/:id/delete', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      let contentType = 'comment';
      let uid = parseInt(req.session.user.id);
      let url = '/' + contentType + '/' + encodeURIComponent(req.params.id);

      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: contentType + ' deletion page - error in prepGetRequest'}); return; }

      // get content from database
      let comment = new handy.content.Comment();
      comment.load(url, 'url', (function(err){
        if(err){
          comment = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading ' + contentType + ' for deletion'}); 
          return _endProcessingWithFail(err, req, res, 1);
        }

        // check if user has the permissions to delete this content
        handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, this.id, 'id', 'delete', (function(err, result){
          if(err){
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error checking user permission to delete ' + contentType});
            return _endProcessingWithFail(err, req, res, 1);
          }
          if(!result){
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. ' + contentType + ' can not be opened for deletion. id: ' + this.id});
            return _endProcessingWithFail(null, req, res, 1);
          }

          // check if content is deleted
          this.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(this.deleted){
            handy.system.redirectBack(1, req, res);
            comment = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: contentType + ' already deleted. ' + contentType + ' can not be opened for deletion. id: ' + this.id});
            return;
          }

          pageInfo.title = 'Delete ' + contentType + ' - ' + this.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = this.title;
          pageInfo.other.defaultValue.bodyValue = this.body;
          pageInfo.other.defaultValue.urlValue = this.url;
          pageInfo.other.defaultValue.publishValue = this.published;

          pageInfo.other.contentId = this.id;
          pageInfo.other.contentType = contentType;
          pageInfo.other.action = 'delete';

          let categoryId = this.category === null ? null : parseInt(this.category);
          let categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');

          let logDetail = {type: 'info', category: 'content', message: contentType + ' opened for deletion. id: ' + this.id};
          handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
          comment = null; // free up memory
          return;
        }).bind(this));
      }).bind(comment));
    });
  });

  app.use('/comment', commentR);


  categoryR.get('/:id', handy.user.checkPermission('content.category', ['Can view content']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'category display page - error in prepGetRequest'}); return;}
      handy.content.getCategorySelectOptions({id:4}, 'parent');
      let contentType = 'category';
      let contentId = _getCategoryId(req);

      // if contentId is null, stop processing
      if(!contentId){
        handy.system.logger.record('error', {error: new Error('content not found'), req: req, category: 'content', message: 'error loading category for display. id: ' + contentId}); 
        return _endProcessingWithFail(err, req, res);  
      }

      // get content from database
      let category = new handy.content.Category();
      category.load(contentId, 'id', (function(err, result){
        if(err){
          category = null; // free up memory
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading category for display. id: ' + this.id}); 
          return _endProcessingWithFail(err, req, res);
        }

        // check if category is deleted
        if(this.deleted){
          handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted');
          handy.system.redirectBack(0, req, res);
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'category already deleted.  category can not be displayed. id: ' + this.id});
          category = null;
          return;
        }

        pageInfo.title = 'Category: ' + this.name + ' | ' + handy.system.systemVariable.getConfig('siteName');
        res.send('this will display the category page\n' + JSON.stringify(this, '\t'));
        category = null; // free up memory
        handy.system.logger.record('info', {req: req, category: 'content', message: 'category displayed. id: ' + this.id});
        return;
      }).bind(category));
    });
  });

  categoryR.get('/:id/edit', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'category edit page - error in prepGetRequest'}); return;}
      
      pageInfo.other.contentType = 'category';
      pageInfo.other.action = 'edit';
      var uid = req.session.user.id;
      var contentType = 'category';

      var urlId = _getCategoryId(req, contentType);
      if(urlId === undefined){
        res.redirect('/notfound'); 
        handy.system.logger.record('warn', {req: req, category: 'content', message: 'category can not be found. id: ' + req.params.id});
        return;
      }
      pageInfo.other.contentId = urlId;
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'id', 'edit', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error checking user permission to edit category. id: ' + urlId}); 
          return _endProcessingWithFail(err, req, res);
        }
        if(!result){
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. category can not be opened for editing. id: ' + urlId});
          return _endProcessingWithFail(null, req, res);
        }
        // get content from cache
        var category = new handy.content.Category();
        category.load(urlId, 'id', function(err, result){
          if(err){
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading category for editing. id: ' + urlId}); 
            category = null; // free up memory
            return _endProcessingWithFail(err, req, res);
          }

          pageInfo.title = 'Editing category: ' + category.name + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.destination = '/category/' + urlId;
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.nameValue = category.name;
          pageInfo.other.defaultValue.parentValue = category.parent;
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = {id: urlId, name: category.name, parent: category.parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'parent');
          // check if category is deleted
          category.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(category.deleted){
            handy.system.redirectBack(0, req, res);
            category = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'category already deleted. category can not be opened for editing. id: ' + urlId});
            return;
          }

          var logDetail = {type: 'info', category: 'content', message: 'category opened for editing. id: ' + urlId};
          handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
          category = null; // free up memory
          return;
        });
      });
    });
  });


  categoryR.get('/:id/delete', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'category deletion page - error in prepGetRequest'}); return;}
      
      pageInfo.other.contentType = 'category';
      pageInfo.other.action = 'delete';
      var uid = req.session.user.id;
      var contentType = 'category';

      var urlId = _getCategoryId(req, contentType);
      if(urlId === undefined){
        res.redirect('/notfound');
        handy.system.logger.record('warn', {req: req, category: 'content', message: 'category not found. id: ' + req.params.id}); 
        return;
      }
      pageInfo.other.contentId = urlId;
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'id', 'delete', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, message: 'error checking user permission to delete category. id: ' + urlId}); 
          return _endProcessingWithFail(err, req, res);
        }
        if(!result){
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. category can not be opened for deletion. id: ' + urlId});
          return _endProcessingWithFail(null, req, res);
        }
        // get content from cache
        var category = new handy.content.Category();
        category.load(urlId, 'id', function(err, result){
          if(err){
            category = null; // free up memory
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error loading category for deletion'}); 
            return _endProcessingWithFail(err, req, res);
          }

          pageInfo.title = 'Deleting category: ' + category.name + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.destination = '/content/create/category';
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.nameValue = category.name;
          pageInfo.other.defaultValue.parentValue = category.parent;
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = {id: urlId, name: category.name, parent: category.parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'parent');
          // check if category is deleted
          category.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(category.deleted){
            handy.system.redirectBack(0, req, res);
            category = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'category already deleted.  category can not be opened for deletion. id: ' + urlId});
            return;
          }
          
          var logDetail = {type: 'info', category: 'content', message: 'category opened for deletion. id: ' + urlId};
          handy.system.display(req, res, 'contentdisplay', pageInfo, logDetail);
          category = null; // free up memory
          return;
        });
      });
    });
  });

  app.use('/category', categoryR);


  /**************************************************************************************************
   **************************************************************************************************
   **************       Transitional routes i.e. always redirect to another page       **************
   **************************************************************************************************
   *************************************************************************************************/
  
  /* email verification page - Tested
   * users land here from links sent to them.  Clicking on the link helps to verify that their email
   * address is correct
   */
  app.get('/verifyemail', function(req, res){
    var pageInfo = {
      title: null,
      config: handy.system.systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query},
      googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
      other: {}
    };
    var link = decodeURIComponent(req.query.link);
    var expiryPeriod = 0;  // one-time links for email verification never expire
    var verifyUser = new handy.user.User();
    verifyUser.email = decodeURIComponent(req.query.email);
    // verify if link provided in url is good, if so, login requestor
    verifyUser.verifyOneTimeLink('email', link, expiryPeriod, (function(err, flag, returnedUser){
      if(err){
        handy.system.systemMessage.set(req, 'danger', err.message);
        res.redirect('/');
        verifyUser = null;  // free up memory
        handy.system.logger.record('error', {error: err, req: req, category: 'user', message: 'error verifying one-time link'}); 
        return;
      }

      switch(flag){
        case 'success':
          // log user in to site
          this.authenticated = true;
          this.login(req, (function(err){
            if(err){
              handy.system.systemMessage.set(req, 'danger', err.message);
              res.redirect('/');
              verifyUser = null;  // free up memory
              handy.system.logger.record('error', {error: err, req: req, category: 'user', message: 'error logging user in after verifying one-time link. id: ' + verifyUser.id}); 
              return;
            }
            handy.user.postUserVerificationProcessing([this.id], (function(err){
              if(err){
                handy.system.systemMessage.set(req, 'danger', 'Your email address has been verified but an error occured with post verification processing: ', err);
                res.redirect('/');
                verifyUser = null;  // free up memory
                handy.system.logger.record('error', {error: err, req: req, category: 'user', message: 'error with post verification processing after verifying one-time link. id: ' + verifyUser.id}); 
                return;
              }
              // set success message
              handy.system.systemMessage.set(req, 'success', 'Your email address has been verified, welcome!');
              res.redirect('/welcomepage');
              handy.system.logger.record('info', {req: req, category: 'user', message: 'user one-time link verified. id: ' + verifyUser.id});
              verifyUser = null;  // free up memory
              return;
            }).bind(this));
          }).bind(this));
          break;
        case 'link expired':
          handy.system.systemMessage.set(req, 'danger', 'This link has expired.  Please <a class="alert-link" href="/requestonetimelink?type=email&email=' + encodeURIComponent(this.email) + '">request another verification email</a> be sent to you');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user one-time link verification failed. link expired. id: ' + verifyUser.id});
          verifyUser = null;  // free up memory
          return;
          break;
        case 'user not found':
          handy.system.systemMessage.set(req, 'danger', 'Verification failed! User not found.');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user one-time link verification failed.  user not found. id: ' + verifyUser.id});
          verifyUser = null;  // free up memory
          return;
          break;
        case 'no previous request':
        case 'match failed':
          handy.system.systemMessage.set(req, 'danger', 'Verification failed! Try again or <a class="alert-link" href="/requestonetimelink?type=email&email=' + encodeURIComponent(this.email) + '">request another verification email</a> be sent to you');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'one-time link match failed. id: ' + verifyUser.id});
          verifyUser = null;  // free up memory
          return;
          break;
      }
    }).bind(verifyUser));
  });


  /* Request one-time link - Tested
   * users get referred to this page and which auto-generates a one-time link (for email or password change) 
   * which is then sent to them.  Usually the redirect comes from when a previous one-time link is rejected (expired, wrong, etc)
   * Users should never have to self-direct to this page but should be redirected from the application 
   * since this page needs some special parameters to function
   */
  app.get('/requestonetimelink', function(req, res){
    var pageInfo = {
      title: null,
      config: handy.system.systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query},
      googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
      other: {}
    };
    
    var type = req.query.type;
    var verifyUser = new handy.user.User();
    verifyUser.email = decodeURIComponent(req.query.email);
    
    // get requesting user details
    verifyUser.load(verifyUser.email, 'email', (function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Something went wrong.  Requested email was not sent!');
        res.redirect('/');
        verifyUser = null;  // free up memory
        handy.system.logger.record('error', {error: err, req: req, category: 'user', message: 'error loading user requesting one-time link. id: ' + verifyUser.id}); 
        return;
      }
      // generate one-time link
      this.createOneTimeLink(type, (function(err){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Something went wrong.  Requested email was not sent!');
          res.redirect('/');
          handy.system.logger.record('error', {error: err, req: req, category: 'user',  message: 'error creating one-time link. id: ' + verifyUser.id}); 
          verifyUser = null;  // free up memory
          return;
        }
        // update the user record with the new one-time link
        this.save((function(err){
          if(err){
            handy.system.systemMessage.set(req, 'danger', 'Something went wrong.  Requested email was not sent!');
            res.redirect('/');
            handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error saving user account after generating one-time link. id: ' + verifyUser.id});
            verifyUser = null;  // free up memory 
            return;
          }
          // send the notification to the user
          var receipient = {name: this.name, email: this.email};
          var sender = {name: handy.system.systemVariable.getConfig('siteName'), email: handy.system.systemVariable.getConfig('siteEmail')};
          var body; 
          var subject;
          switch(type){
            case 'email':
              subject = handy.system.tokenReplace(handy.system.systemVariable.getConfig('email_verification_resend_subject'), req, this);
              body = {text: handy.system.tokenReplace(handy.system.systemVariable.getConfig('email_verification_resend_body'), req, this)};   
              break;
            case 'password':
              subject = handy.system.tokenReplace(handy.system.systemVariable.getConfig('password_recovery_subject'), req, this);
              body = {text: handy.system.tokenReplace(handy.system.systemVariable.getConfig('password_recovery_body'), req, this)};
              break;
          }
          
          handy.system.sendEmail(receipient, sender, subject, body, (function(err, message){
            if(err){
              handy.system.systemMessage.set(req, 'danger', 'Something went wrong.  Verification email was not sent');
              res.redirect('/');
              handy.system.logger.record('error', {error: err, req: req, category: 'user', message: 'error sending email to user after generating one-time link. id: ' + verifyUser.id}); 
              verifyUser = null;  // free up memory
              return;
            }
            // send success message to user
            handy.system.systemMessage.set(req, 'success', 'Verification link has been sent to your email address, please check your mailbox');
            res.redirect('/');
            handy.system.logger.record('info', {req: req, category: 'user', message: 'one-time link requested and sent. id: ' + verifyUser.id});
            verifyUser = null;  // free up memory
            return;
          }).bind(this));
        }).bind(this));
      }).bind(this));
    }).bind(verifyUser));
  });


  /* one-time login page - Tested
   * Users clicking on a one-time login link sent to them end up here.  if the one-time link is recognized, 
   * the user is logged in and presented with a password reset screen
   */
  app.get('/onetimelogin', handy.user.requireAuthenticationStatus('unauthenticated'), function(req, res){
    var pageInfo = {
      title: null,
      config: handy.system.systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.hostname, path: req.path, query: req.query},
      googleAnalyticsCode: handy.system.systemVariable.getConfig('googleAnalyticsId'),
      other: {}
    };
    
    var link = decodeURIComponent(req.query.link);
    var expiryPeriod = 1;  // one-time links expire after 1 day
    var testUser = new handy.user.User();
    testUser.email = decodeURIComponent(req.query.email);
    
    // verify if link provided in url is good, if so, login requestor
    testUser.verifyOneTimeLink('password', link, expiryPeriod, (function(err, flag, returnedUser){
      if(err){
        handy.system.systemMessage.set(req, 'danger', err.message);
        res.redirect('/');
        testUser = null;  // free up memory
        handy.system.logger.record('error', {error: err, message: 'error verifying one-time link for user login. email: ' + testUser.email}); 
        return;
      }
      
      switch(flag){
        case 'success':
          // log user in to site
          this.authenticated = true;
          this.login(req, (function(err){
            if(err){
              handy.system.systemMessage.set(req, 'danger', err.message);
              res.redirect('/');
              handy.system.logger.record('error', {error: err, req: req, category: 'content', message: 'error logging in user after one-time login verification successful. id: ' + testUser.id});
              testUser = null;  // free up memory 
              return;
            }
            // set success message and ask user to set a new password
            handy.system.systemMessage.set(req, 'success', 'Please select a new password');
            res.redirect('/user/' + this.id + '/password/reset');
            handy.system.logger.record('info', {req: req, category: 'user', message: 'user one-time login successful. id: ' + testUser.id});
            testUser = null;  // free up memory
            return;
          }).bind(this));
          break;
        case 'link expired':
          handy.system.systemMessage.set(req, 'danger', 'This link has expired.  Please <a class="alert-link" href="/requestonetimelink?type=password&email=' + encodeURIComponent(this.email) + '">request another verification email</a> be sent to you');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user one-time login unsuccessful. link expired. id: ' + testUser.id});
          testUser = null;  // free up memory
          return;
          break;
        case 'user not found':
          handy.system.systemMessage.set(req, 'danger', 'Verification failed! User not found.');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user one-time login unsuccessful. user not found. id: ' + testUser.id});
          testUser = null;  // free up memory
          return;
          break;
        case 'no previous request':
          handy.system.systemMessage.set(req, 'danger', 'Password reset and verification links can only be used once.  This link may already have been used.  Please <a class="alert-link" href="/requestonetimelink?type=password&email=' + req.query.email + '">request a new link</a> to be sent to your email address');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user one-time login unsuccessful. no previous request for one-time login link. id: ' + testUser.id});
          testUser = null;
          return;
          break;
        case 'match failed':
          handy.system.systemMessage.set(req, 'danger', 'Verification failed! Try again or <a class="alert-link" href="/requestonetimelink?type=password&email=' + encodeURIComponent(this.email) + '">request another verification email</a> be sent to you');
          res.redirect('/');
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user one-time login unsuccessful. link does not match. id: ' + testUser.id});
          testUser = null;  // free up memory;
          return;
          break;
      }
    }).bind(testUser));
  });
  
};

// get the id of the category if the name is provided
function _getCategoryId(req){
  // if id is already a number then just return that
  if(!_.isNaN(parseInt(req.params.id))){
    return parseInt(req.params.id);
  }
  
  let categoryList = handy.system.systemVariable.getConfig('categoryList');
  let id = null;
  _.forEach(categoryList, function(category, catId){
    if(category.name.toLowerCase() === req.params.id.toLowerCase()){
      id = catId;
    }
  });
  return id;
}


function _endProcessingWithFail(err, req, res, redirectSteps){ 
  redirectSteps = redirectSteps || 0;

  if(err){
    handy.system.systemMessage.set(req, 'danger', 'An error occured: ' + err.message);
  } else {
    handy.system.systemMessage.set(req, 'danger', 'You do not have permission to edit this content');
  }
  handy.system.redirectBack(redirectSteps, req, res); // redirect to previous page (or how many previous as required)
  return;
}
