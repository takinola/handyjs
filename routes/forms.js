/*
 * Form POST processing
 */
 var _ = require('underscore')
  , handy = require('../../handy/lib/handy').get('handy')
  , express = require('express')
  ;

module.exports = function(app){
  var siteinstall = express.Router();
  var router = express.Router();

  // test form: used to quickly perform tests of various scenarios
  app.post('/testpage', handy.user.checkPermission('system.System', ['can run tests']), function(req, res, next){
    handy.system.backupDatabase(req, res, function(err){
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    });
  });

  // siteInstall form - Tested
  siteinstall.post('/', handy.user.requireAuthenticationStatus('unauthenticated'), handy.system.validateForm('siteInstall'), function(req, res){
    console.log('starting siteinstall...');
    handy.bootstrap.runInstallation(req, res, function(err){
      console.log('runInstallation complete: ', err);
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'something went wrong with the installation!\n' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
      } else {
        res.redirect('/configuration');
      }
    });
  });
  app.use('/siteinstall', siteinstall);

  // user login form - Tested
  app.post('/userlogin', handy.user.requireAuthenticationStatus('unauthenticated'), handy.system.validateForm('userLogin'), function(req, res){
    // set final redirect destination
    var destination = req.query.destination === undefined ? '/welcomepage' : handy.utility.prepDestinationUri(req.query.destination, 'decode');

    var potentialUser = new handy.user.User();
    potentialUser.authenticate(req.body.userEmail, req.body.userPassword, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Invalid email or password!');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        potentialUser = null;  // free up memory
        return
      }
       
      potentialUser.login(req, function(err){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Invalid email or password!');
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          potentialUser = null;  // free up memory
          return;
        }
        
        handy.system.systemMessage.set(req, 'success', 'Welcome '+ potentialUser.name);
        res.redirect(destination);
        potentialUser = null;  // free up memory
        return;
      });
    });
  });
  
  // user registration form - Tested (need to test scenario where user needs admin verification)
  app.post('/userregister', handy.system.validateForm('userRegister'), function(req, res){
    // set final redirect destination
    var destination = req.query.destination === undefined ? '/welcomepage' : handy.utility.prepDestinationUri(req.query.destination, 'decode');
    var newUser = new handy.user.User();
    newUser.register(req, (function(err, loginstatus){
      if(err){
        handy.system.systemMessage.set(req, 'danger', err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        newUser = null;  // free up memory
        return;
      }
      switch(loginstatus){
        case 'loggedin':
          // registration successful and new user has been logged in
          handy.system.systemMessage.set(req, 'success', 'New user registration successful');
          res.redirect(destination);
          newUser = null;  // free up memory
          return;
          break;
        case 'notloggedin':
          // registration successful but new user is not logged in (usually because the account was created by another user who is currently loggedin or user needs to verify their email address)
          var message;
          if(handy.system.systemVariable.getConfig('emailVerify')){
            message = 'Registration successful. Please check your email for instructions on how to complete your registration';
          } else {
            message = 'New user registration successful';
          }

          handy.system.systemMessage.set(req, 'success', message);
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          newUser = null;  // free up memory
          return;
          break;
      }
    }).bind(newUser));
  });
  
  // user password reset request form - Tested
  app.post('/passresetrequest', handy.user.requireAuthenticationStatus('unauthenticated'), handy.system.validateForm('passResetRequest'), function(req, res){
    var resetUser = new handy.user.User();
    resetUser.email = req.body.userEmail;
    resetUser.initiatePasswordReset(req, (function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'password reset failed. ' + err.message);
      } else {
        handy.system.systemMessage.set(req, 'success', 'Instructions to reset your password have been sent to your email address');
      }
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      resetUser = null;  // free up memory
      return;
    }).bind(resetUser));
  });
  
  // general configuration form - Tested
  app.post('/configgeneral', handy.user.checkPermission('system.System', ['can alter system configuration']), handy.system.validateForm('configGeneral'), function(req, res){
    var update = req.body;
    delete update._csrf;  // remove the _csrf token
    update.siteEmailSSL = update.siteEmailSSL === '1' ? true : false;  // convert siteEmailSSL from 1/0 to true/false
    update.siteEmailTLS = update.siteEmailTLS === '1' ? true : false;  // convert siteEmailTLS from 1/0 to true/false
    handy.system.systemVariable.updateConfig(update, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Changes could not be saved!');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      }
      
      // set cron tasks
      if(req.body.backupFreq && req.body.backupDestinationType && req.body.backupDestination){
        var freq = parseInt(req.body.backupFreq) * 60;
        handy.system.addCronTask('handy scheduled backup', handy.system.backupDatabase, freq, function(err){
          if(err){handy.system.systemMessage.set(req, 'danger', 'Backup could not be scheduled');}
          handy.system.systemMessage.set(req, 'success', 'Changes saved');
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          return; 
        });
      } else {
        handy.system.systemMessage.set(req, 'success', 'Changes saved');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return; 
      }
    });
  });

  // general configuration form - Tested
  app.post('/configaccount', handy.user.checkPermission('system.System', ['can alter system configuration']), handy.system.validateForm('configAccount'), function(req, res){
    var update = req.body;
    // checkboxes are ommited from req.body when their value is false so need to add it back
    update.emailVerify = req.body.emailVerify === 'true' ? true : false;
    update.account_activation_checkbox = req.body.account_activation_checkbox === 'true' ? true : false;
    update.account_blocked_checkbox = req.body.account_blocked_checkbox === 'true' ? true : false;
    update.account_cancelled_checkbox = req.body.account_cancelled_checkbox === 'true' ? true : false;
    delete update._csrf;  // remove the _csrf token
    handy.system.systemVariable.updateConfig(update, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Changes could not be saved!');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      }
      handy.system.systemMessage.set(req, 'success', 'Changes saved');
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    });
  });
  
  // password change form (type can be 'change' or 'reset'.  'change' means the user knows the current password, 'reset' means the user does not have the current password) - Tested
  app.post('/password/:type', handy.user.requireAuthenticationStatus('authenticated'), handy.system.validateForm('passwordChange'), function(req, res){
    var oldPassword = req.body.oldPassword || null;
    var newPassword = req.body.newPassword;
    
    // set up user object
    var user = new handy.user.User();
    
    // populate user object from the current session
    user.cloneObject(req.session.user);

    user.changePassword(req.params.type, oldPassword, newPassword, req, function(err, loggedinstatus){
      if(err){
        handy.system.systemMessage.set(req, 'danger', err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        user = null;  // free up memory
        return;
      }
      
      switch (loggedinstatus){
        case 'loggedin':
          // paswword change successful.  all good
          handy.system.systemMessage.set(req, 'success', 'Password change successful');
          res.redirect('/user/' + user.id);
          user = null;  // free up memory
          return;
          break;
        case 'notloggedin':
          // password changed but user login may not have been successful
          handy.system.systemMessage.set(req, 'danger', 'Password changed but you may not be properly logged in.  Please <a class="alert-link" href="/logout">logout</a> and login again with your new password');
          res.redirect('/');
          user = null;  // free up memory
          return;
          break;
      }
    });
  });
  
  // user profile form - Tested
  app.post('/userprofile', handy.user.requireAuthenticationStatus('authenticated'), handy.system.validateForm('userProfile'), function(req, res){
    var uid = parseInt(req.body.userId_hidden);
    var name = req.body.userName;
    var email = req.body.userEmail;
    
    // create user object used to perform profile update
    var updateUser = new handy.user.User();
    // check if user is updating their own profile
    var ownAccount = req.session.user.id === uid ? true : false;
  
    switch(ownAccount){
      case true:
        // user is updating their own account
        //load user record from database
        updateUser.load(uid, 'id', (function(err){
          if(err){
            handy.system.systemMessage.set(req, 'danger', 'Update was not successful!');
            handy.system.redirectBack(0, req, res);  // redirect to previous page
            updateUser = null;  // free up memory
            return;
          }
          // update user information
          this.name = name;
          this.email = email;
          this.authenticated = true;  // user must be authenticated to make this post.  need to set this correctly so that when the session user object is updated (assuming the update is successful), the user does not lose their authenticated status (which is one of the steps to checking if they are still logged in)
          
          /* check that the new email address is unique (it is not allowed to have two users with 
           * the same email address).  To do this, define the record being checked for uniqueness (recordToTest)
           * and any record that is expected to already be in the database (expectedRecord) and so can be safely 
            * ignored (e.g. user is updating their account with no change in email address, so it is expected
            * that there will already be a record with the same email address so that record can be ignored when
            * checking for uniqueness)
            */
          var recordToTest = {
            column: 'email',
            value: this.email
          };
          var expectedRecord = {
            column: 'id',
            value: this.id
          };
          
          handy.utility.checkUniqueRecord(recordToTest, expectedRecord, 'user', (function(err, uniqueFlag){
            if(uniqueFlag){
              // email to be saved is unique so proceed
              // save user record
              this.save((function(err){
                if(err){
                  handy.system.systemMessage.set(req, 'danger', 'Update was not successful!');
                  handy.system.redirectBack(0, req, res);  // redirect to previous page
                  updateUser = null;  // free up memory
                  return;
                }
            
                // inform user of successful update
                handy.system.systemMessage.set(req, 'success', 'Profile updated');
                // update user record in session memory
                req.session.user = this;
                handy.system.redirectBack(0, req, res);  // redirect to previous page
                updateUser = null;  // free up memory
                return;
              }).bind(this));            
            } else {
              // email to be saved is NOT unique.  stop processing
              handy.system.systemMessage.set(req, 'danger', 'Another user with that email address exists already.  Please choose a different email address');
              handy.system.redirectBack(0, req, res);  // redirect to previous page
              updateUser = null;  // free up memory
              return;
            }
          }).bind(this));
        }).bind(updateUser));
        break;
      case false:
        // user is updating another user's account.  this is only allowed if the current user has the right permissions
        handy.user.checkPermission('user.User', ["can modify other users' accounts"], (function(err, approved){
          if(err || !approved){
            handy.system.systemMessage.set(req, 'danger', 'You do not have permission to edit that user profile');
            res.redirect('/accessdenied');
            return;        
          }
          
          // current user has the appropriate permissions, so profile update can continue
          //load user record from database
          this.load(uid, 'id', (function(err){
            if(err){
              handy.system.systemMessage.set(req, 'danger', 'Update was not successful!');
              handy.system.redirectBack(0, req, res);  // redirect to previous page
              updateUser = null;  // free up memory
              return;
            }
            // update user information
            this.name = name;
            this.email = email;
            
            /* check that the new email address is unique (it is not allowed to have two users with 
             * the same email address).  To do this, define the record being checked for uniqueness (recordToTest)
             * and any record that is expected to already be in the database (expectedRecord) and so can be safely 
              * ignored (e.g. user is updating their account with no change in email address, so it is expected
              * that there will already be a record with the same email address so that record can be ignored when
              * checking for uniqueness)
              */
            var recordToTest = {
              column: 'email',
              value: this.email
            };
            var expectedRecord = {
              column: 'id',
              value: this.id
            };
      
            handy.utility.checkUniqueRecord(recordToTest, expectedRecord, 'user', (function(err, uniqueFlag){
              if(uniqueFlag){
                // email to be saved is unique so proceed
                // save user record
                this.save((function(err){
                  if(err){
                    handy.system.systemMessage.set(req, 'danger', 'Update was not successful!');
                    handy.system.redirectBack(0, req, res);  // redirect to previous page
                    updateUser = null;  // free up memory
                    return;
                  }
                  // inform user of successful update
                  handy.system.systemMessage.set(req, 'success', 'Profile updated');
                  handy.system.redirectBack(0, req, res);  // redirect to previous page
                  updateUser = null;  // free up memory
                  return;
                }).bind(this));            
              } else {
                // email to be saved is NOT unique.  stop processing
                handy.system.systemMessage.set(req, 'danger', 'Another user with that email address exists already.  Please choose a different email address');
                handy.system.redirectBack(0, req, res);  // redirect to previous page
                updateUser = null;  // free up memory
                return;
              }
            }).bind(this));
          }).bind(this));
        
        }).bind(updateUser))(req, res);
        break;
    }
  });
  
  // cancel the current user account - Tested
  app.post('/cancelaccount/:uid', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    
    // if the user id is not specified then end processing
    if(typeof req.params.uid === 'undefined'){
      handy.system.systemMessage.set(req, 'danger', 'Please specify a valid user account');
      res.redirect('/notfound'); 
      return;
    }
    
    var uid = parseInt(req.params.uid);
    
    // check if user has the permission to execute this cancel request
    var ownaccount = uid === req.session.user.id ? true : false;
    if(!ownaccount){
      // check if the user has permissons to cancel other user's accounts
      handy.user.checkPermission('user.User', ["can modify other users' accounts"], function(err, approved){
        if(err || !approved){
          handy.system.systemMessage.set(req, 'danger', 'You do not have permission to request this account cancellation');
          res.redirect('/accessdenied');
          return;
        }
        
        // set up cancelUser object
        var cancelUser = new handy.user.User();
        cancelUser.id = uid;
        cancelUser.load(cancelUser.id, 'id', function(err){
          _cancelUserAccountAndLogoutUser.bind(cancelUser)(req, res, 'nologout');
          cancelUser = null;  // free up memory
          return;
        });
      })(req, res);
    }
    
    if(ownaccount){
      var cancelUser = new handy.user.User();
      cancelUser.cloneObject(req.session.user);
      _cancelUserAccountAndLogoutUser.bind(cancelUser)(req, res, 'logout');
      cancelUser = null;  // free up memory
      return;
    }
  });
  
  // approve pending user registration requests
  app.post('/userregisterapproval', handy.user.checkPermission('user.User', ["can modify other users' accounts"]), function(req, res){
    // get uids
    var uidList = [];
    _.forEach(req.body, function(val, key){
      // each key has the format 'id_x' where x is the uid
      if(key.substr(0,3) === 'id_' && val === 'true'){uidList.push(parseInt(key.substr(3)));}
    });

    // stop processing if no uids are found
    if(uidList.length === 0){
      handy.system.systemMessage.set(req, 'danger', 'Please select at least one account for approval');
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
      
    // approve account registrations
    handy.user.approveAccountRegistrationRequest(uidList, req, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      }
      
      // publish all previously unpublished content created by the users
      handy.content.makeUserContentPublished(uidList, req, res, function(err_1){
        if(err_1){
          handy.system.systemMessage.set(req, 'danger', 'Some of drafts created by these users may not have been automatically published.  Please manually edit them in order to make the drafts visible to other users on the site');
        }
        
        handy.system.systemMessage.set(req, 'success', 'Selected accounts approved');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      });
    });
  });
  
  // create a new role
  app.post('/rolecreate', handy.user.requireAuthenticationStatus('authenticated'), handy.system.validateForm('roleCreate'), handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){
    var role = req.body.newRoleName;
    handy.user.createRole(role, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error creating new role: ' + err.message);
      } else {
        handy.system.systemMessage.set(req, 'success', 'New role "' +  role + '" has been created');
      }
      
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    });
  });
  
  // delete an existing role
  app.post('/roledelete', handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){
    var role = req.body.deleteRole
    handy.user.deleteRole(role, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error deleting role: ' + err.message);
      } else {
        handy.system.systemMessage.set(req, 'success', 'Role "' +  role + '" has been deleted');
      }
      
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
      
    });
  });
  
  // reset permission system if redis database is corrupted
  app.post('/aclreset', handy.user.requireAuthenticationStatus('authenticated'), function(req, res){
    // there is no permission required to access this route because when this functionality is only really needed when the permission system is broken
    handy.user.aclReset(function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Access control system could not be reset\nerr: ', err);
      } else {
        handy.system.systemMessage.set(req, 'success', 'Access control system reset completed successfully');
      }
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }); 
  });
  
  
  app.post('/permissionupdate', handy.user.checkPermission('user.User', ["Can modify other user's accounts"]), function(req, res){

    // remove csrf
    delete req.body._csrf
    
    // get all the role resource permissions that are returned
    var rrp = Object.keys(req.body);
    var rPUpdateObject = {}; // this object contains all the role permission updates to be performed
    rrp.forEach(function(combinedRRP){
      // combinedRRP is in the format role_resource_permission
      var rrpArray = combinedRRP.split('_');
      var role = rrpArray[0].toLowerCase();
      var resource = rrpArray[1].toLowerCase();
      var perm = rrpArray[2].toLowerCase();
      // skip all administrator roles since this role's permissions cannot be modified
      if(role !== 'administrator'){
        rPUpdateObject[role] = rPUpdateObject[role] || {};
        rPUpdateObject[role][resource] = rPUpdateObject[role][resource] || [];
        rPUpdateObject[role][resource].push(perm);
      }
    });
    
    // prepare the role permission update array
    var rPUpdateArray = [];
    _.forEach(rPUpdateObject, function(resourcePerms, rolename){
      _.forEach(resourcePerms, function(permArray, resourcename){
        rPUpdateArray.push({
          role: rolename,
          resource: resourcename,
          permissions: permArray
        });
      });
    });
    
    handy.user.updateRolePermission(rPUpdateArray, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error updating permissions: ' + err.message);
      } else {
        handy.system.systemMessage.set(req, 'success', 'Permissions have been updated');
      }
      
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    });
  });
  
  app.post('/content/:type/:id/:action', handy.system.validateForm('createContent'), function(req, res){
    // remove csrf token
    delete req.body._csrf;

    // set final redirect destination
    var destination = handy.utility.prepDestinationUri(req.query.destination, 'decode');
    destination = destination !== 'undefined' ? destination : null;  // if destination is not defined, set to null
    switch(req.params.action.toLowerCase()){
      case 'create':
        return _createNewContent(req, res, destination);
        break;
      case 'edit':     
        return _editExistingContent(req, res, destination);
        break;
      case 'delete':
        return _deleteExistingContent(req, res, destination);
        break;
    }
  });
  
  
  app.post('/sitemapsetting', handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){
    // remove csrf token
    delete req.body._csrf;
    var sitemapContent = {};
    var sitemapDefault = {};
    
    _.forEach(req.body, function(val, key){
      // values from the form are in format 'contenttype_parametertype: value'
      var contentType = key.split('_')[0];
      var paramType = key.split('_')[1];
      
      if(contentType !== 'default'){
        sitemapContent[contentType] = sitemapContent[contentType] || {};
        sitemapContent[contentType][paramType] = val;
      } else {
        sitemapDefault[paramType] = val;
      }
    });
    
    var sitemapConfig = {content: sitemapContent, default: sitemapDefault};
    handy.system.systemVariable.updateConfig({sitemapConfig: sitemapConfig}, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error updating sitemap settings: ' + err.message);
      } else {
        handy.system.systemMessage.set(req, 'success', 'Sitemap settings successfully updated');
      }
      
      handy.system.redirectBack(0, req, res); // redirect to previous page
    });
  });
  
  app.post('/contact', handy.system.validateForm('contactForm'), function(req, res){
    // contact form sunmissions are sent to the site admin (i.e. user with uid=1)
    var admin = new handy.user.User();
    admin.load(1, 'id', function(err){
      if(err){
        admin = null;  // free up memory
        handy.system.systemMessage.set(req, 'danger', 'Error sending message.  Please try again: ' + err.message);
        handy.system.redirectBack(0, req, res);
        return;
      }
      var receipient = {email: admin.email};
      var sender = {name: handy.system.systemVariable.getConfig('siteName'), email: handy.system.systemVariable.getConfig('siteEmail')};
      var now = new Date();  
      var subject = '[' + handy.system.systemVariable.getConfig('siteName') + '] Contact Form from ' + now.toDateString();
      var body = 'Contact form submission\n\n';
      body += 'Name: ' + req.body.contact_name + '\n';
      body += 'Email: ' + req.body.contact_email + '\n'
      body += 'Message: ' + req.body.contact_message;
      var replyAddress = req.body.contact_name ? req.body.contact_name + ' <' + req.body.contact_email + '>' : req.body.contact_email;
    
      handy.system.sendEmail(receipient, sender, subject, body, null, null, replyAddress, function(err){
        admin = null;  //free up memory
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Error sending message.  Please try again: ' + err.message);
          handy.system.redirectBack(0, req, res);
          return;
        }
        handy.system.systemMessage.set(req, 'success', 'Message sent.  We will be in touch shortly');
        handy.system.redirectBack(0, req, res);
        return;
      });
    });

  });
};

/*
 * private function for app.post('/content/:type/:action)
 * creates and saves a new content object
 */
function _createNewContent(req, res, destination){
  var seed;  // this will contain all the information required to populate the content being created
  var type = req.params.type.toLowerCase();

  // check if user has permission to create the content
  handy.user.checkPermission(req.session.user.id, 'content.' + type, ['Can create new content', 'Can create draft content'], function(err, flag){
    if(err){
      handy.system.systemMessage.set(req, 'danger', 'Error creating a new ' + type + ': ' + err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }

    if(!flag){
      handy.system.systemMessage.set(req, 'danger', 'You are not authorized to create a new ' + type);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
  
  
    seed = req.body;
    seed.creator = req.session.user.id;
    seed.category = seed.category === 'nocategoryselected' || seed.category === undefined ? null : parseInt(seed.category);
    
    // check if user is restricted to creating draft content, if so set content to draft
    handy.user.checkPermission(req.session.user.id, 'content.' + type, ['Can create new content'], function(err, flag){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error creating new ' + type + ': ' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      }
      
      // if user does not have permission to create new content, set published to false
      if(!flag){seed.published = false; }
      
      handy.content.createContent(type, seed, function(err, newContent){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Error creating a new ' + type + ': ' + err.message);
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          return;
        }
    
        handy.system.systemMessage.set(req, 'success', 'New ' + type + ' created');
    
        // redirect back if this is a new category being created
        if(type.toLowerCase() === 'category'){
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          return;
        }
  
        // redirect to the newly created content (or to the specified destination)
        !destination ? res.redirect(newContent.url) : res.redirect(destination);
        return;
      });
    })(req, res);
  })(req, res); 
}

/*
 * private function for app.post('/content/:type/:contentId/:action)
 * edits an existing  content object
 */
function _editExistingContent(req, res, destination){
  var uid = parseInt(req.session.user.id);
  var contentType = req.params.type.toLowerCase();
  var actionType = 'edit';
  var urlId;
  
  if(contentType !== 'category'){
    urlId = _getUrlId(req, contentType); // get the content id (in the case where the url alias is provided)
    // ensure values are of the right type
    req.body.category = (req.body.category === 'nocategoryselected' || req.body.category === undefined) ? null : parseInt(req.body.category);

    if(req.body.published){
      req.body.published = true;
    } else {
      req.body.published = false;
    }

    var beginPath = '/' + contentType + '/';
    req.body.url = (req.body.url !== '' && typeof req.body.url !== 'undefined') ? beginPath + encodeURIComponent(req.body.url) : beginPath + encodeURIComponent(req.body.title);
    req.body.url = req.body.url.replace(/%20/g, '-'); // replace spaces with dash signs
    //req.body.url = req.body.url.replace(/%2B/g, '+');  // if spaces are double encoded i.e. user entered a plus sign already but it has been encoded again, revert back to plus
  } else {
    // processing for category type
    urlId = _getCategoryId(req);
    req.body.name = req.body.newCategoryName;
    req.body.parent = _.isNaN(parseInt(req.body.parentcategory)) ? null : parseInt(req.body.parentcategory);
  }
  
  // check if user has the permission to perform edit
  handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, actionType, function(err, flag){
    if(err){
      handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
  
    if(!flag){
      handy.system.systemMessage.set(req, 'danger', 'You do not have the permission to edit this ' + contentType);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
    // create new content instance
    var newContent = handy.content.createNewInstance(contentType);
  
    // get original values for database
    newContent.load(urlId, 'id', function(err){
      if(err){
        newContent = null;  // free up memory
        handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      }

      // update with new values
      _.forEach(req.body, function(value, parameter){
        newContent[parameter] = value;  // need to ensure the values have been converted to the correct type prior to this
      });

      newContent.save(function(err){
        if(err){
          newContent = null;  // free up memory
          handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          return;
        }
        
        // update config with new category information
        if(contentType === 'category'){
          var categoryList = handy.system.systemVariable.getConfig('categoryList');
          categoryList[newContent.id] = {name: newContent.name, parent: newContent.parent};
          handy.system.systemVariable.updateConfig({categoryList: categoryList}, function(err){
            if(err){
              newContent = null;  // free up memory
              handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
              handy.system.redirectBack(0, req, res);  // redirect to previous page
              return;
            }
            
            // redirect back (or go to the specified destination)
            handy.system.systemMessage.set(req, 'success', contentType + ' edit succesful');
            !destination ? handy.system.redirectBack(0, req, res) : res.redirect(destination);
            newContent = null;  // free up memory
            return;
          });
        } else {
          // redirect to view the content that was just edited (or the specified destination)
          handy.system.systemMessage.set(req, 'success', contentType + ' edit succesful');
          !destination ? res.redirect(newContent.url) : res.redirect(destination);
          newContent = null;  // free up memory
          return; 
        }
      }); 
    });   
  });

}

/*
 * private function for app.post('/content/:type/:contentId/:action)
 * deletes an existing content object
 */
function _deleteExistingContent(req, res, destination){
  var uid = parseInt(req.session.user.id);
  var contentType = req.params.type.toLowerCase();
  var actionType = 'delete';
  var urlId;
  
  if(contentType !== 'category'){
    urlId = _getUrlId(req, contentType); // get the content id (in the case where the url alias is provided)
  } else {
    urlId = _getCategoryId(req);
  }
  
  // check if user has the permission to perform edit
  handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, actionType, function(err, flag){
    if(err){
      handy.system.systemMessage.set(req, 'danger', 'Error deleting ' + contentType + ': ' + err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
    
    if(!flag){
      handy.system.systemMessage.set(req, 'danger', 'You do not have the permission to delete this ' + contentType);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
    
    // user has all the appropriate permissions, so proceed with content deleting
    var delContent = handy.content.createNewInstance(contentType);
    
    // get original values for database
    delContent.load(urlId, 'id', function(err){
      if(err){
        delContent = null;  // free up memory
        handy.system.systemMessage.set(req, 'danger', 'Error deleting ' + contentType + ': ' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        return;
      }
    
      // go ahead and delete
      delContent.delete(function(err){
        if(err){
          delContent = null;  // free up memory
          handy.system.systemMessage.set(req, 'danger', 'Error deleting ' + contentType + ': ' + err.message);
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          return;
        }
        
        // save deleted content
        delContent.save(function(err){
          if(err){
            delContent = null;  // free up memory
            handy.system.systemMessage.set(req, 'danger', 'Error deleting ' + contentType + ': ' + err.message);
            handy.system.redirectBack(0, req, res);  // redirect to previous page
            return;
          }
          
          // if content is a category, then we need to remove it from the config
          if(contentType === 'category'){
            var categoryList = handy.system.systemVariable.getConfig('categoryList');

            delete categoryList[delContent.id];
            handy.system.systemVariable.updateConfig({categoryList: categoryList}, function(err){
              if(err){
                delContent = null;  // free up memory
                handy.system.systemMessage.set(req, 'danger', 'Error deleting ' + contentType + ': ' + err.message);
                handy.system.redirectBack(0, req, res);  // redirect to previous page
                return;
              }

              // redirect to welcomepage
              handy.system.systemMessage.set(req, 'success', contentType + ' succesfully deleted');
              !destination ? handy.system.redirectBack(0, req, res) : res.redirect(destination);
              delContent = null;  // free up memory
              return;
            });
          } else {
            // redirect to welcomepage
            handy.system.systemMessage.set(req, 'success', contentType + ' succesfully deleted');
            !destination ? res.redirect('/welcomepage') : res.redirect(destination);
            delContent = null;  // free up memory
            return; 
          }
        });
      });
    });
  });
}


/* private funciton for app.post('/content/:type/:contentId/:action)
 * gets the id of the content if the alias was provided
 */
function _getUrlId(req, contentType){
  var alias = '/' + contentType + '/' + encodeURIComponent(req.params.id);
  alias = alias.replace(/%2B/g, '+');  // ensure spaces are encoded with '+'
  var urlId = _.isNaN(parseInt(req.params.id)) ? handy.system.getContentFromAlias(alias).id : parseInt(req.params.id);
  return urlId;
}

/* private function for _editExistingContent
 * get the id of the category if the name is provided
 */
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

/* private function for app.post('/cancelaccount/:uid)
 * cancels the user account sent to it and logs out the user if logoutrequest is 'logout'
 */
function _cancelUserAccountAndLogoutUser(req, res, logoutrequest){
  // cancel user account to be deleted
  this.cancelAccount(req, (function(err){
    if(err){
      handy.system.systemMessage.set(req, 'danger', 'Account cancellation unsuccessful.  Please try again');
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      return;
    }
    
    // logout user, if required
    if(logoutrequest === 'logout'){
      res.redirect('/logout');
      return;
    }
    
    // redirect to welcome page
    res.redirect('/welcomepage');
    return;
  }).bind(this));
}