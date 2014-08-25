/*
 * Routes for generic pages e.g. home, about, welcome, etc
 */

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


  /**************************************************************************************************
   **************************************************************************************************
   ****************************       Site management routes       **********************************
   **************************************************************************************************
   *************************************************************************************************/
  
  // test page: for running various experiments - Tested
  app.get('/testpage', handy.user.checkPermission('system.System', ['Can run tests']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Test scenarios'},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'testpage - prepGetRequest'}); return;}

      handy.system.logger.report(req, res, function(nullValue, returnObject){
        //console.log('error: ' + returnObject.err);
        //console.log('activity report: ' + returnObject['activity report']);
        res.render('testpage', {pageInfo: pageInfo});
      });
    });
  });
  
  // test page: for running unauthenticated various experiments
  app.get('/testpageunauth', handy.user.requireAuthenticationStatus('unauthenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Test scenarios'},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err}); return;}
      
      url.resolve('/testpageunauth', '/crazypage.html');
      //console.log('current url is ' + global.location.href);
      //history.pushState({current: 'window.location.href'}, '', 'crazypage.html');
      res.render('testpage', {pageInfo: pageInfo});
    });
  });
  
  // Handy installation page - Tested
  app.get('/install', function(req, res){
    // default information
    var pageInfo = {
      title: 'Handy Installation Guide',
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.host, path: req.path, query: req.query, url: req.url},
      other: {}
    };

    // only allow installation if not previously done
    if(!handy.system.systemVariable.get('installation_flag')){
      res.render('install', {pageInfo: pageInfo});
    } else {
      handy.system.logger.record('info', {req: req, category: 'system', message: 'installation complete'});
      res.redirect('/');
      return;
    }
  });

  /* Welcome page - Tested
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
        res.render('index', {pageInfo: pageInfo});
        handy.system.logger.record('info', {req: req, category: 'system', message: 'welcome page'});
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

  // Site configuration page - Tested
  configurationR.get('/', handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){

    // otherwise, continue preparing the configuration page
    handy.system.prepGetRequest({
      info: {title: 'Site configuration | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'configuration - error in prepGetRequest'}); return;}
      
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
        pageInfo.other.cronPath = handy.system.systemVariable.getConfig('cronRecord').path;
        res.render('configuration', {pageInfo: pageInfo});
        handy.system.logger.record('info', {req: req, category: 'system', message: 'display configuration page'});
        return;
      });
    
      // get accounts pending registration i.e verified = false;
      function _getAccountsPendingRegistration(asyncCallback){
        var pool = handy.system.systemVariable.get('pool');
        pool.getConnection(function(err, connection){
          if(err){
            asyncCallback(err);
            //handy.system.systemMessage.set(req, 'danger', 'Something went wrong: ' + err.message);
            //handy.system.redirectBack(0, req, res);  // redirect to current page
          } else {
            var query = 'SELECT id, name, email, createdate FROM user WHERE verified=false';
            connection.query(query, function(err, results){
              if(err){
                asyncCallback(err);
                //handy.system.systemMessage.set(req, 'danger', 'Something went wrong');
                //handy.system.redirectBack(0, req, res);  // redirect to current page
              } else {
                if(results.length > 0){
                  asyncCallback(null, results);
                  //pageInfo.other.accountpendingregistration = results;
                } else {
                  asyncCallback(null, []);
                }
                //res.render('configuration', {pageInfo: pageInfo});
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

  configurationR.get('/permissions', handy.user.checkPermission('system.System', ['can alter system configuration']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Update role permissions | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'permissions - error in prepGetRequest'}); return;}

      // get the resource and permissions lists
      pageInfo.other.resourcePermissionList = handy.system.systemVariable.getConfig('resourcePermissionList');
      pageInfo.other.rolesPermissionGrant = handy.system.systemVariable.getConfig('rolesPermissionGrant');
    
      res.render('permissions', {pageInfo: pageInfo});
      handy.system.logger.record('info', {req: req, category: 'system', message: 'display permissions page'});
      return;
    });
  });
  app.use('/configuration', configurationR);

  // Access denied page - Tested
  app.get('/accessdenied', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Access denied | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'access denied page - error in prepGetRequest'}); return;}
      
      res.statusCode = 403;
      var accessdeniedpage = handy.system.systemVariable.getConfig('default403Page');
      if(accessdeniedpage === '' || accessdeniedpage === null || accessdeniedpage === '/accessdenied'){
        res.render('403accessdenied', {pageInfo: pageInfo}); 
        handy.system.logger.record('warn', {req: req, category: 'system', message: '403 access denied'});
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

  // 404 not found page - Tested
  app.get('/notfound', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Page not found (404) | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'not found page - error in prepGetRequest'}); return;}
      
      res.statusCode = 404;
      var notfoundpage = handy.system.systemVariable.getConfig('default404Page');
      if(notfoundpage === '' || notfoundpage === null || notfoundpage === '/notfound'){
        res.render('404notfound', {pageInfo: pageInfo}); 
        handy.system.logger.record('warn', {req: req, category: 'system', message: '404 not found'});
        return;
      } else {
        // restore the system messages before redirect.  This is required if redirecting after doing a prepGetRequest
        // because prepGetRequest moves the messages to the res object, which then gets wiped out after a redirect
        handy.system.restoreSystemMessage(req, res); 
        res.redirect(res.statusCode, notfoundpage);
        handy.system.logger.record('warn', {req: req, category: 'system', message: '404 not found'});
        return;
      }
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
  
  app.get('/sitemap.xml', handy.system.recordUrlHistory(), function(req, res){
    // get all content urls
    var alias = handy.system.systemVariable.getConfig('alias');
    var siteUrls = Object.keys(alias);
    
    // get sitemap configuration
    var sitemapConfig = handy.system.systemVariable.getConfig('sitemapConfig');
    
    // get base url
    var baseUrl = req.protocol + '://' + req.host;
    
    var xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    siteUrls.forEach(function(val, key){

      var contentType = val.split('/')[1];
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
      xml += '<loc>'+ baseUrl + val + '</loc>';
      xml += '<changefreq>'+ freq +'</changefreq>';
      xml += '<priority>'+ priority +'</priority>';
      xml += '</url>';
    });
    
    xml += '</urlset>';

    res.header('Content-Type', 'text/xml');
    res.send(xml);
    handy.system.logger.record('info', {req: req, category: 'sitemap', message: 'sitemap submitted successfully'});
  });
  
  // contact form
  app.get('/contact', function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Contact form | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'contact page - error in prepGetRequest'}); return;}
      
      res.render('contactform', {pageInfo: pageInfo});
      handy.system.logger.record('info', {req: req, category: 'system', message: 'contact page'});
    });
  });
  
  
  /**************************************************************************************************
   **************************************************************************************************
   ****************************       User management routes       **********************************
   **************************************************************************************************
   *************************************************************************************************/
  
  // Login page - Tested
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

     res.render('login', {pageInfo: pageInfo});
     handy.system.logger.record('info', {req: req, category: 'system', message: 'login page'});
    });
  });
  
  // logout page - Tested
  app.get('/logout', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    var pageInfo = {
      title: null,
      config: handy.system.systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.host, path: req.path, query: req.query},
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
            res.render('userprofile', {pageInfo: pageInfo});
            requestedUser = null;  // free up memory
            handy.system.logger.record('info', {req: req, category: 'user', message: 'user profile ' + uid + ' displayed'});
            return;
          });
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
              res.render('userprofile', {pageInfo: pageInfo});
              requestedUser = null;  // free up memory
              handy.system.logger.record('info', {req: req, category: 'user', message: 'user profile ' + uid + ' displayed'});
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
      res.render('passwordchange', {pageInfo: pageInfo});
      handy.system.logger.record('info', {req: req, category: 'system', message: 'display password change page'});
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
      switch (ownaccount){
        case true:
          // user is cancelling their own account so go ahead
          pageInfo.other.cancelUser = [{id: uid, name: pageInfo.user.name, email: pageInfo.user.email, createdate: pageInfo.user.createdate.toString()}];
          res.render('cancelaccount', {pageInfo: pageInfo});
          handy.system.logger.record('info', {req: req, category: 'user', message: 'display account cancellation form. user: ' + uid});
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
              res.render('cancelaccount', {pageInfo: pageInfo});
              cancelUser = null;  // free up memory
              handy.system.logger.record('info', {req: req, category: 'user', message: 'display account cancellation form. user: ' + uid});
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
  
  app.get('/content/create/:type', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    handy.system.prepGetRequest({
      info: {title: 'Create new ' + req.params.type + ' | ' + handy.system.systemVariable.getConfig('siteName')},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'content creation page - error in prepGetRequest'}); return;}
      
      // get list of all content types in the system
      var contentTypeList = handy.system.systemVariable.getConfig('contentTypeList');
      contentTypeList = Object.keys(contentTypeList);
    
      pageInfo.other.contentTypeList = contentTypeList;
      pageInfo.other.contentType = req.params.type;

      var categoryList = handy.system.systemVariable.getConfig('categoryList');
      pageInfo.other.categoryDefault = {id: null, name: null, parent: null};
      pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');
    
      pageInfo.other.action = 'create';

      res.render('contentdisplay', {pageInfo: pageInfo});
      handy.system.logger.record('info', {req: req, category: 'system', message: 'display content creation page'});
      return;
    });
  });
  

  storyR.get('/:id', handy.user.checkPermission('content.Story', ['Can view content']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'story display page - error in prepGetRequest'}); return;}
      
      var contentType = 'story';
      pageInfo.siteinfo.path = '/' + contentType + pageInfo.siteinfo.path; // add back the mount point to the path
      pageInfo.other.destination = handy.utility.prepDestinationUri(pageInfo.siteinfo.path, 'encode');

      var urlId = _getUrlId(req, contentType);
      if(urlId === undefined){res.redirect('/notfound'); return;}
      // get content from cache
      var story = new handy.content.Story();

      story.load(urlId, 'id', function(err, result){
        if(err){
          story = null; // free up memory
          handy.system.logger.record('error', {error: err, message: 'error loading story for display'}); 
          return _endProcessingWithFail(err, req, res);
        }

        pageInfo.title = _.escape(story.title).substr(0, 40) + ' | ' + handy.system.systemVariable.getConfig('siteName');
        pageInfo.description = _.escape(story.title) + '. ' + _.escape(story.body.substr(0,130));
        pageInfo.canonical = req.protocol + '://' + req.host + story.url;
        pageInfo.other.storyValue = {};
        pageInfo.other.storyValue.title = _.escape(story.title);
        pageInfo.other.storyValue.link = story.link;
        pageInfo.other.storyValue.body = _.escape(story.body).replace(/\r?\n/g, '<br/>');
        pageInfo.other.storyValue.contentlist = story.contentlist;
      
        // check if story is published or deleted
        !story.published ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' is not published') : null;
        story.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
        if(!story.published || story.deleted){
          handy.system.redirectBack(0, req, res);
          story = null;
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'story not displayed because not published or deleted. id: ' + urlId});
          return;
        }
      
        // get comments
        pageInfo.other.comments = {};
        story.getRelatedContent('comment', function(err, commentList){
          if(err){
            pageInfo.other.comments = {0:{text: 'comments could not be retrieved at this time', creator: null}};
            handy.system.logger.record('error', {error: err, message: 'error getting related comments for story. id: ' + story.id});
          } else {
            commentList.forEach(function(comm, commId){
              pageInfo.other.comments[commId] = {text: _.escape(comm.body).replace(/\r?\n/g, '<br/>'), creator: comm.name};
            });
          }

          // check if user has rights to edit this content (used to decide to display the edit/delete link next to the content)
          var uid = parseInt(req.session.user.id);
          handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'edit', function(err, result){
            if(err || !result){
              pageInfo.other.displayEditLink = false;
            } else {
              pageInfo.other.displayEditLink = true;
            }
            res.render('story', {pageInfo: pageInfo});
            handy.system.logger.record('info', {req: req, category: 'content', message: 'story displayed. id: ' + story.id});
            story = null; // free up memory
            return;
          });
        });
      });
    });
  });

  storyR.get('/:id/edit', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'story edit page - error in prepGetRequest'}); return;}
      
      pageInfo.other.contentType = 'story';
      pageInfo.other.action = 'edit';
    
      var contentType = 'story';
      var uid = parseInt(req.session.user.id);
      var urlId = _getUrlId(req, contentType); // get the content id (in the case where the url alias is provided)
      if(urlId === undefined){res.redirect('/notfound'); return;}
      pageInfo.other.contentId = urlId;
    
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'edit', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, message: 'error loading story for display. id: ' + urlId}); 
          return _endProcessingWithFail(err, req, res);
        }
        if(!result){
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied to open story for editing. id: ' + urlId});
          return _endProcessingWithFail(null, req, res);
        }
      
        // get content from cache
        var story = new handy.content.Story();
        story.load(urlId, 'id', function(err, result){
          if(err){
            story = null; // free up memory
            handy.system.logger.record('error', {error: err, message: 'error loading story for editing. id: ' + story.id}); 
            return _endProcessingWithFail(err, req, res);
          }
        
          // check if story is deleted
          story.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(story.deleted){
            handy.system.redirectBack(0, req, res);
            story = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'story can not be edited. id: ' + urlId});
            return;
          }

          pageInfo.title = 'Editing Story - ' + story.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = story.title;
          pageInfo.other.defaultValue.bodyValue = story.body;
          pageInfo.other.defaultValue.urlValue = story.url;
          pageInfo.other.defaultValue.categoryValue = parseInt(story.category);
          pageInfo.other.defaultValue.publishValue = story.published;
        
          var categoryId = story.category === null ? null : parseInt(story.category);
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');
        
          res.render('contentdisplay', {pageInfo: pageInfo});
          handy.system.logger.record('info', {req: req, category: 'content', message: 'story opened for editing. id: ' + urlId});
        });
      });
    });
  });

  storyR.get('/:id/delete', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'story deletion page - error in prepGetRequest'}); return; }
      
      pageInfo.other.contentType = 'story';
      pageInfo.other.action = 'delete';
    
      var contentType = 'story';
      var uid = parseInt(req.session.user.id);
      var urlId = _getUrlId(req, contentType); // get the content id (in the case where the url alias is provided)
      if(urlId === undefined){res.redirect('/notfound'); return;}
      pageInfo.other.contentId = urlId;

      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'delete', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, message: 'error checking user permission to delete story'});
          return _endProcessingWithFail(err, req, res);
        }
        if(!result){
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. story can not be opened for deletion. id: ' + urlId});
          return _endProcessingWithFail(null, req, res);
        }
      
        // get content from cache
        var story = new handy.content.Story();
        story.load(urlId, 'id', function(err, result){
          if(err){
            story = null; // free up memory
            handy.system.logger.record('error', {error: err, message: 'error loading story for deletion'}); 
            return _endProcessingWithFail(err, req, res);
          }
        
          // check if story is deleted
          story.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(story.deleted){
            handy.system.redirectBack(0, req, res);
            story = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'story already deleted. story can not be opened for deletion. id: ' + urlId});
            return;
          }

          pageInfo.title = 'Delete Story - ' + story.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = story.title;
          pageInfo.other.defaultValue.bodyValue = story.body;
          pageInfo.other.defaultValue.urlValue = story.url;
          pageInfo.other.defaultValue.publishValue = story.published;
        
          var categoryId = story.category === null ? null : parseInt(story.category);
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');

          res.render('contentdisplay', {pageInfo: pageInfo});
          handy.system.logger.record('info', {req: req, category: 'content', message: 'story opened for deletion. id: ' + urlId});
          return;
        });
      });
    });
  });

  app.use('/story', storyR);
  

  commentR.get('/:id', handy.user.checkPermission('content.Comment', ['Can view content']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'comment display page - error in prepGetRequest'}); return; }
      
      var contentType = 'comment';
      pageInfo.siteinfo.path = '/' + contentType + pageInfo.siteinfo.path; // add back the mount point to the path

      var urlId = _getUrlId(req, contentType);
      if(urlId === undefined){
        handy.system.logger.record('warn', {req: req, category: 'content', message: 'comment not found for display. id: ' + req.params.id});
        res.redirect('/notfound'); 
        return;
      }
      // get content from cache
      var comment = new handy.content.Comment();

      comment.load(urlId, 'id', function(err, result){
        if(err){
          comment = null; // free up memory
          handy.system.logger.record('error', {error: err, message: 'comment could not be loaded. id: ' + comment.id}); 
          return _endProcessingWithFail(err, req, res);
        }

        pageInfo.title = ('comment: '+ _.escape(comment.title) + ' - ' + _.escape(comment.body)).substr(0,40) + ' | ' + handy.system.systemVariable.getConfig('siteName');
        pageInfo.description = _.escape(comment.title) + '. ' + _.escape(comment.body.substr(0,130));
        pageInfo.canonical = req.protocol + '://' + req.host + comment.url;
        pageInfo.other.commentValue = {};
        pageInfo.other.commentValue.title = _.escape(comment.title);
        pageInfo.other.commentValue.link = comment.link;
        pageInfo.other.commentValue.body = _.escape(comment.body).replace(/\r?\n/g, '<br/>');
        pageInfo.other.commentValue.contentlist = comment.contentlist;
      
        // check if comment is published or deleted
        !comment.published ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' is not published') : null;
        comment.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
        if(!comment.published || comment.deleted){
          handy.system.redirectBack(0, req, res);
          comment = null;
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'comment not published or deleted. comment can not be displayed. id: ' + urlId});
          return;
        }

        // check if user has rights to edit this content (used to decide to display the edit/delete link next to the content)
        var uid = parseInt(req.session.user.id);
        handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'edit', function(err, result){
          if(err || !result){
            pageInfo.other.displayEditLink = false;
          } else {
            pageInfo.other.displayEditLink = true;
          }

          res.render('comment', {pageInfo: pageInfo});
          handy.system.logger.record('info', {req: req, category: 'content', message: 'comment displayed. id: ' + comment.id});
          comment = null; // free up memory
          return;
        });
      });
    });
  });

  commentR.get('/:id/edit', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'comment edit page - error in prepGetRequest'}); return;}
      
      pageInfo.other.contentType = 'comment';
      pageInfo.other.action = 'edit';
    
      var contentType = 'comment';
      var uid = parseInt(req.session.user.id);
      var urlId = _getUrlId(req, contentType); // get the content id (in the case where the url alias is provided)
      if(urlId === undefined){res.redirect('/notfound'); return;}
      pageInfo.other.contentId = urlId;
    
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'edit', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, message: 'error checking user permission to edit comment. id: ' + urlId}); 
          return _endProcessingWithFail(err, req, res);
        }
        if(!result){
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. comment can not be opened for editing. id: ' + urlId});
          return _endProcessingWithFail(null, req, res);
        }
      
        // get content from cache
        var comment = new handy.content.Comment();
        comment.load(urlId, 'id', function(err, result){
          if(err){
            comment = null; // free up memory
            handy.system.logger.record('error', {error: err, message: 'error loading comment for editing. id: ' + comment.id}); 
            return _endProcessingWithFail(err, req, res);
          }
        
          // check if comment is deleted
          comment.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(comment.deleted){
            handy.system.redirectBack(0, req, res);
            comment = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'comment already deleted. comment can not be opened for editing. id: ' + urlId});
            return;
          }

          pageInfo.title = 'Editing Comment - ' + comment.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = comment.title;
          pageInfo.other.defaultValue.bodyValue = comment.body;
          pageInfo.other.defaultValue.urlValue = comment.url;
          pageInfo.other.defaultValue.publishValue = comment.published;
        
          var categoryId = comment.category === null ? null : parseInt(comment.category);
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');
        
          res.render('contentdisplay', {pageInfo: pageInfo});
          handy.system.logger.record('info', {req: req, category: 'content', message: 'comment opened for editing. id: ' + urlId});
        });
      });
    });
  });

  commentR.get('/:id/delete', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
    }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'comment deletion page - error in prepGetRequest'}); return; }
      
      pageInfo.other.contentType = 'comment';
      pageInfo.other.action = 'delete';
    
      var contentType = 'comment';
      var uid = parseInt(req.session.user.id);
      var urlId = _getUrlId(req, contentType); // get the content id (in the case where the url alias is provided)
      if(urlId === undefined){
        res.redirect('/notfound');
        handy.system.logger.record('warn', {req: req, category: 'content', message: 'comment not found for deletion. id: ' + req.params.id});
        return;
      }
      pageInfo.other.contentId = urlId;
    
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'delete', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, message: 'error checking user permission to delete comment. id: ' + urlId}); 
          return _endProcessingWithFail(err, req, res);
        }
        if(!result){
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'permission denied. comment can not be opened for deletion. id: ' + urlId});
          return _endProcessingWithFail(null, req, res);
        }
      
        // get content from cache
        var comment = new handy.content.Comment();
        comment.load(urlId, 'id', function(err, result){
          if(err){
            comment = null; // free up memory
            handy.system.logger.record('error', {error: err, message: 'error loading comment for deletion'}); 
            return _endProcessingWithFail(err, req, res);
          }
        
          // check if comment is deleted
          comment.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
          if(comment.deleted){
            handy.system.redirectBack(0, req, res);
            comment = null;
            handy.system.logger.record('warn', {req: req, category: 'content', message: 'comment already deleted. comment can not be opened for deletion. id: ' + urlId});
            return;
          }

          pageInfo.title = 'Delete Comment - ' + comment.title + ' | ' + handy.system.systemVariable.getConfig('siteName');
          pageInfo.other.defaultValue = {};
          pageInfo.other.defaultValue.titleValue = comment.title;
          pageInfo.other.defaultValue.bodyValue = comment.body;
          pageInfo.other.defaultValue.urlValue = comment.url;
          pageInfo.other.defaultValue.publishValue = comment.published;
        
          var categoryId = comment.category === null ? null : parseInt(comment.category);
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          pageInfo.other.categoryDefault = categoryId === null ? {id: null, name: null, parent: null} : {id: categoryId, name: categoryList[categoryId].name, parent: categoryList[categoryId].parent};
          pageInfo.other.categoryOptions = handy.content.getCategorySelectOptions(pageInfo.other.categoryDefault, 'self');
        
          res.render('contentdisplay', {pageInfo: pageInfo});
          handy.system.logger.record('info', {req: req, category: 'content', message: 'comment opened for deletion. id: ' + urlId});
        });
      });
    });
  });

  app.use('/comment', commentR);


  categoryR.get('/:id', handy.user.checkPermission('content.category', ['Can view content']), function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'category display page - error in prepGetRequest'}); return;}
      
      var contentType = 'category';

      var urlId = _getCategoryId(req, contentType);
      if(urlId === undefined){
        res.redirect('/notfound'); 
        handy.system.logger.record('warn', {req: req, category: 'content', message: 'category not found. id: ' + req.params.id});
        return;}
      // get content from cache
      var category = new handy.content.Category();
      category.load(urlId, 'id', function(err, result){
        if(err){
          category = null; // free up memory
          handy.system.logger.record('error', {error: err, message: 'error loading category for display. id: ' + urlId}); 
          return _endProcessingWithFail(err, req, res);
        }

        pageInfo.title = 'Category: ' + category.name + ' | ' + handy.system.systemVariable.getConfig('siteName');
        // check if category is deleted
        category.deleted ? handy.system.systemMessage.set(req, 'danger', 'This ' + contentType + ' has been deleted') : null;
        if(category.deleted){
          handy.system.redirectBack(0, req, res);
          category = null;
          handy.system.logger.record('warn', {req: req, category: 'content', message: 'category already deleted.  category can not be displayed. id: ' + urlId});
          return;
        }

        res.send('this will display the category page\n' + JSON.stringify(category, '\t'));
        category = null; // free up memory
        handy.system.logger.record('info', {req: req, category: 'content', message: 'category displayed. id: ' + urlId});
        return;
      });
    });
  });

  categoryR.get('/:id/edit', function(req, res){
    handy.system.prepGetRequest({
      info: {title: null},
      action: []
      }, req, res, function(err, pageInfo){
      if(err){handy.system.logger.record('error', {error: err, message: 'category edit page - error in prepGetRequest'}); return;}
      
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
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'edit', function(err, result){
        if(err){
          handy.system.logger.record('error', {error: err, message: 'error checking user permission to edit category. id: ' + urlId}); 
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
            category = null; // free up memory
            handy.system.logger.record('error', {error: err, message: 'error loading category for editing. id: ' + category.id}); 
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
          res.render('contentdisplay', {pageInfo: pageInfo});
          category = null; // free up memory
          handy.system.logger.record('info', {req: req, category: 'content', message: 'category opened for editing. id: ' + urlId});
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
      if(err){handy.system.logger.record('error', {error: err, message: 'category deletion page - error in prepGetRequest'}); return;}
      
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
      handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, 'delete', function(err, result){
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
            handy.system.logger.record('error', {error: err, message: 'error loading category for deletion'}); 
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
          res.render('contentdisplay', {pageInfo: pageInfo});
          category = null; // free up memory
          handy.system.logger.record('info', {req: req, category: 'content', message: 'category opened for deletion. id: ' + urlId});
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
      siteinfo: {protocol: req.protocol, host: req.host, path: req.path, query: req.query},
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
        handy.system.logger.record('error', {error: err, message: 'error verifying one-time link'}); 
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
              handy.system.logger.record('error', {error: err, message: 'error logging user in after verifying one-time link. id: ' + verifyUser.id}); 
              return;
            }
            handy.user.postUserVerificationProcessing([this.id], (function(err){
              if(err){
                handy.system.systemMessage.set(req, 'danger', 'Your email address has been verified but an error occured with post verification processing: ', err);
                res.redirect('/');
                verifyUser = null;  // free up memory
                handy.system.logger.record('error', {error: err, message: 'error with post verification processing after verifying one-time link. id: ' + verifyUser.id}); 
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
      config: systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.host, path: req.path, query: req.query},
      googleAnalyticsCode: systemVariable.getConfig('googleAnalyticsId'),
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
        handy.system.logger.record('error', {error: err, message: 'error loading user requesting one-time link. id: ' + verifyUser.id}); 
        return;
      }
      // generate one-time link
      this.createOneTimeLink(type, (function(err){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Something went wrong.  Requested email was not sent!');
          res.redirect('/');
          handy.system.logger.record('error', {error: err, message: 'error creating one-time link. id: ' + verifyUser.id}); 
          verifyUser = null;  // free up memory
          return;
        }
        // update the user record with the new one-time link
        this.save((function(err){
          if(err){
            handy.system.systemMessage.set(req, 'danger', 'Something went wrong.  Requested email was not sent!');
            res.redirect('/');
            handy.system.logger.record('error', {error: err, message: 'error saving user account after generating one-time link. id: ' + verifyUser.id});
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
              handy.system.logger.record('error', {error: err, message: 'error sending email to user after generating one-time link. id: ' + verifyUser.id}); 
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
      config: systemVariable.get('config'),
      user: req.session.user || {},
      siteinfo: {protocol: req.protocol, host: req.host, path: req.path, query: req.query},
      googleAnalyticsCode: systemVariable.getConfig('googleAnalyticsId'),
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
              handy.system.logger.record('error', {error: err, message: 'error logging in user after one-time login verification successful. id: ' + testUser.id});
              testUser = null;  // free up memory 
              return;
            }
            // set success message and ask user to set a new password
            handy.system.systemMessage.set(req, 'success', 'Please select a new password');
            res.redirect('/password/reset');
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

// gets the id of the content if the alias was provided
function _getUrlId(req, contentType){
  var alias = '/' + contentType + '/' + encodeURIComponent(req.params.id);
  alias = alias.replace(/%2B/g, '+');  // ensure spaces are encoded with '+'
  var urlId = _.isNaN(parseInt(req.params.id)) ? handy.system.getContentFromAlias(alias).id : parseInt(req.params.id);
  return urlId;
}

// get the id of the category if the name is provided
function _getCategoryId(req){
  // if id is already a number then just return that
  if(!_.isNaN(parseInt(req.params.id))){
    return parseInt(req.params.id);
  }
  
  var categoryList = handy.system.systemVariable.getConfig('categoryList');
  var id = null;
  _.forEach(categoryList, function(category, catId){
    if(category.name.toLowerCase() === req.params.id.toLowerCase()){
      id = catId;
    }
  });
  return id;
}


function _endProcessingWithFail(err, req, res){
  if(err){
    handy.system.systemMessage.set(req, 'danger', 'An error occured: ' + err.message);
  } else {
    handy.system.systemMessage.set(req, 'danger', 'You do not have permission to edit this content');
  }
  handy.system.redirectBack(0, req, res); // redirect to previous page
  return;
}
