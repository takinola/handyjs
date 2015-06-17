/*
 * Form POST processing
 */
'use strict';

 var _ = require('underscore')
  , async = require('async')
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    handy.bootstrap.runInstallation(req, res, function(err){
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    // set final redirect destination
    var destination = req.query.destination === undefined ? '/welcomepage' : req.query.destination;
    var potentialUser = new handy.user.User();
    potentialUser.authenticate(req.body.userEmail, req.body.userPassword, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Invalid email or password!');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        handy.system.logger.record('warn', {req: req, category: 'user', message: 'user login authentication failed - invalid email or password. id: ' + req.body.userEmail});
        potentialUser = null;  // free up memory
        return
      }
       
      potentialUser.login(req, function(err){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Invalid email or password!');
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user login failed - invalid email or password. id: ' + req.body.userEmail});
          potentialUser = null;  // free up memory
          return;
        }
        
        handy.system.systemMessage.set(req, 'success', 'Welcome '+ potentialUser.name);
        res.redirect(destination);
        handy.system.logger.record('info', {req: req, category: 'user', message: 'user login successful. id: ' + potentialUser.id});
        potentialUser = null;  // free up memory
        return;
      });
    });
  });
  
  // user registration form - Tested (need to test scenario where user needs admin verification)
  app.post('/userregister', handy.system.validateForm('userRegister'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    req.query.destination = req.query.destination || '/welcomepage';
    _registerUserAccount(req, res)
    .catch(function(err){
      handy.system.systemMessage.set(req, 'danger', err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      handy.system.logger.record('warn', {req: req, category: 'user', message: 'user registration failed. err: ' + err.message});
    });
  });

  // organization admin user registration form
  app.post('/orgregister', handy.user.requireAuthenticationStatus('unauthenticated'), handy.system.validateForm('orgRegister'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    // set final redirect destination
    req.query.destination = req.query.destination || '/organization/manage';
    let organization = req.body.orgName;

    _createNewOrgRecord(organization)
    .then(_registerOrgAdminUser.bind(null, req, res))
    .catch(function(err){
      handy.system.systemMessage.set(req, 'danger', err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      handy.system.logger.record('warn', {req: req, category: 'user', message: 'user registration for organization admin failed. err: ' + err.message});
      return;
    });

    // create a record for the new organization
    function _createNewOrgRecord(name){
      return new Promise(function(resolve, reject){
        handy.system.createNewOrganization(name)
        .then(function(orgId){
          resolve(orgId);
        })
        .catch(function(err){
          reject(err);
        })
      });
    }

    // register the new user as the org admin
    function _registerOrgAdminUser(req, res, org){
      return new Promise(function(resolve, reject){
        
        // add role and organization to req.body
        req.body._additions = {
          role: ['org_admin'],
          organization: parseInt(org)
        };

        _registerUserAccount(req, res)
        .then(function(){
          return resolve();
        })
        .catch(function(err){
          return reject(err);
        });
      });
    }
  });


  // organization admin user registration form
  app.post('/org-user-provision', handy.user.checkPermission('user.User', ["can modify other users' accounts"]), handy.system.validateForm('orgUserProvision'), function(req, res){
    delete req.body._csrf;  // remove csrf token
    // split list into separate email addresses
    _splitListIntoIndividualEmailAddresses(req.body.orguserprovisionlist)
    .then(_validateEmailAddresses)
    .then(_registerUsersAndSendEmailInvites.bind(null, req))
    .then(function(list){
      // create system messages for each account successfully / unsuccessfully created
      list.forEach(function(registrationResult){
        if(registrationResult.registerStatus){
          handy.system.systemMessage.set(req, 'success', 'Registration invite sent to ' + registrationResult.email);
        } else {
          handy.system.systemMessage.set(req, 'danger', 'Registration invite could not be sent to ' + registrationResult.email + ': ' + registrationResult.error);
        }
      });
      handy.system.redirectBack(0, req, res);  // redirect to previous page
    })
    .catch(function(err){
      handy.system.systemMessage.set(req, 'danger', 'There was an error sending registration invites.  Please try again' + err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
    });


    // takes a bunch of text and splits into an array based on separators
    function _splitListIntoIndividualEmailAddresses(text){
      return new Promise(function(resolve, reject){
        const separators = new RegExp(/[\s,\;\:]+/);  // separators are " ", ":", ";" ","
        let emailList = text.split(separators);
        // regex still allows empty strings so need to remove them
        let listWithoutBlanks = [];
        emailList.map(function(email){
          email !== '' ? listWithoutBlanks.push(email) : null;
        });

        return resolve(listWithoutBlanks);
      });
    }

    // checks if the email addresses are valid
    function _validateEmailAddresses(list){
      return new Promise(function(resolve, reject){
        let invalid = []
        , valid = [];
        list.forEach(function(email){
          handy.utility.validateEmailAddress(email) ? valid.push(email) : invalid.push(email);
        });

        return resolve ({valid: valid, invalid: invalid});
      });
    }

    // registers accounts for each user
    function _registerUsersAndSendEmailInvites(req, list){
      let promiseArray = []
      , dummyReq
      , newUser
      , result
      ;
      _.forEach(list, function(emailList, type){
        if(type === 'valid'){
          emailList.forEach(function(email){
            promiseArray.push(
              // need to figure how to move this section to a separate function
              new Promise(function(resolve, reject){
                // user.register function is badly written: t extracts the requesting user and the created user from
                // the req.body so it is sort of tied to the form format and is not flexible
                // so we need to create a dummy req object and send this with each user.register call
                dummyReq = {
                  protocol: req.protocol,
                  hostname: req.hostname,
                  url: req.url,
                  session: {
                    user: req.session.user
                  },
                  body: {
                    userEmail: email,
                    _additions: {
                      organization: req.session.user.organization
                    }
                  }
                };

                newUser = new handy.user.User();
                newUser.register(dummyReq, function(err, loginStatus){
                  if(err){
                    return err.type ? resolve({email: email, loginStatus: loginStatus, registerStatus: false, error: err.message}) : reject({email: email, error: err.message});
                  }
                  result = {email: email, loginStatus: loginStatus, registerStatus: true};
                  return resolve(result);
                });
              })
            );
          });
        }

        if(type === 'invalid'){
          emailList.forEach(function(email){
            promiseArray.push(
              new Promise(function(resolve, reject){
                result = {email: email, registerStatus: false, error: 'invalid email address'};
                return resolve(result);
              })
            );
          });
        }
      });
      
      return Promise.all(promiseArray);
    }
  });


  // organization admin user registration form
  app.post('/org-user-manage', handy.user.checkPermission('user.User', ["can modify other users' accounts"]), function(req, res){
    delete req.body._csrf;  // remove csrf token
    _getListOfDeactivatedUsers(req.body)
    .then(_getListOfOrganizationUsers.bind(null, req))
    .then(_deactivateOrActivateUsers)
    .then(function(){
      handy.system.systemMessage.set(req, 'success', 'user accounts updated');
      handy.system.redirectBack(0, req, res);  // redirect to previous page
    })
    .catch(function(err){
      handy.system.systemMessage.set(req, 'danger', 'Error activating / deactivating user accounts');
      handy.system.redirectBack(0, req, res);  // redirect to previous page
    });

    function _getListOfDeactivatedUsers(formOutput){
      return new Promise(function(resolve, reject){
        let idAlias = Object.keys(formOutput);  // format ['id_x', 'id_y', ...]
        let idArray = idAlias.map(function(alias){
          return parseInt(alias.slice(3));
        });

        return resolve(idArray);
      });
    }

    function _getListOfOrganizationUsers(req, deactivatedUsers){
      return new Promise(function(resolve, reject){
        let organization = req.session.user.organization || null;
        const pool = handy.system.systemVariable.get('pool');
        pool.getConnection(function(err, connection){
          if(err){ return reject(err); }
          let query = 'SELECT id, name, email, createdate, lastlogin, deleted FROM user ';
          query += 'WHERE organization = ' + connection.escape(organization);
          connection.query(query, function(err, results){
            let allUsers = [];
            if(err){ return reject(err); }
            // remove current user from list
            results.forEach(function(user){
              req.session.user.id !== parseInt(user.id) ? allUsers.push(user) : null;
            });
            let finalResult = {all: allUsers, deactivated: deactivatedUsers};
            return resolve(finalResult);
          });
        });
      });
    }

    function _deactivateOrActivateUsers(userList){
      let allUsers = userList.all;
      let deactivatedUsers = userList.deactivated;

      return Promise.all(allUsers.map(function(processingUser){
        return new Promise(function(resolve, reject){
          let user = new handy.user.User();
          user.load(processingUser.id, 'id', function(err){
            if(err){ return reject(err); }
            let deletedFlag = false;  // flag to set if the user has in fact been deleted
            user.deleted = true;  // assume all users are deleted
            deactivatedUsers.forEach(function(id){
              id === user.id ? deletedFlag = true : null;
            });

            user.deleted = deletedFlag;
            user.save(function(err){
              if(err){ return reject(err); }
              return resolve();
            });
          });
        });
      }));
    }



    
  });


  // user password reset request form - Tested
  app.post('/passresetrequest', handy.user.requireAuthenticationStatus('unauthenticated'), handy.system.validateForm('passResetRequest'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    var resetUser = new handy.user.User();
    resetUser.email = req.body.userEmail;
    resetUser.initiatePasswordReset(req, (function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'password reset failed. ' + err.message);
        handy.system.logger.record('warn', {req: req, category: 'user', message: 'user password reset failed. id: ' + resetUser.id});
      } else {
        handy.system.systemMessage.set(req, 'success', 'Instructions to reset your password have been sent to your email address');
        handy.system.logger.record('info', {req: req, category: 'user', message: 'user password reset successful. id: ' + resetUser.id});
      }
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      resetUser = null;  // free up memory
      return;
    }).bind(resetUser));
  });
  
  // general configuration form - Tested
  app.post('/configgeneral', handy.user.checkPermission('system.System', ['can alter system configuration']), handy.system.validateForm('configGeneral'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
      var asyncFn = [];
      var freq;
      if(req.body.backupFreq && req.body.backupDestinationType && req.body.backupDestination){
        asyncFn.push(
          function(asyncCallback){
            freq = parseInt(req.body.backupFreq) * 60;
            handy.system.addCronTask('handy scheduled backup', handy.system.backupDatabase, freq, function(err){
              asyncCallback(err);
            });
          }
        );
      }

      if(req.body.reportFreq && req.body.reportDestination){
        asyncFn.push(
          function(asyncCallback){
            freq = parseInt(req.body.reportFreq) * 60;
            handy.system.addCronTask('handy scheduled activity report', handy.system.logger.report, freq, function(err){
              asyncCallback(err);
            });
          }  
        );
      }

      // run async.parallel if there are cron tasks
      if(asyncFn.length > 0){
        async.parallel(asyncFn, function(err){
          if(err){handy.system.systemMessage.set(req, 'danger', 'Some or all cron tasks could not be configured')};
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
  
  // theme configuration form
  app.post('/configtheme', handy.user.checkPermission('system.System', ['can alter system configuration']), handy.system.validateForm('configTheme'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    var update = {theme: req.body};

    delete update.theme._csrf;  // remove the _csrf token
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    // if the user id is not specified then end processing
    if(typeof req.params.uid === 'undefined'){
      handy.system.systemMessage.set(req, 'danger', 'Please specify a valid user account');
      res.redirect('/notfound'); 
      handy.system.logger.record('warn', {req: req, category: 'user', message: 'user account cancellation failed. invalid user account. id: ' + req.params.uid});
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
          handy.system.logger.record('warn', {req: req, category: 'user', message: 'user account cancellation failed. permission denied. id: ' + uid});
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
      handy.system.logger.record('info', {req: req, category: 'user', message: 'user account cancelled. id: ' + cancelUser.id});
      cancelUser = null;  // free up memory
      return;
    }
  });
  
  // approve pending user registration requests
  app.post('/userregisterapproval', handy.user.checkPermission('user.User', ["can modify other users' accounts"]), function(req, res){
   req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
        handy.system.logger.record('error', {error: err, message: 'error approving pending user account registration requests. uid list: ' + uidList.toString()});
        return;
      }
      
      // publish all previously unpublished content created by the users
      handy.content.makeUserContentPublished(uidList, req, res, function(err_1){
        if(err_1){
          handy.system.systemMessage.set(req, 'danger', 'Some of drafts created by these users may not have been automatically published.  Please manually edit them in order to make the drafts visible to other users on the site');
          handy.system.logger.record('error', {error: err_1,  message: 'error publishing content for newly created users. uid list: ' + uidList.toString()});
        }
        
        handy.system.systemMessage.set(req, 'success', 'Selected accounts approved');
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        handy.system.logger.record('info', {req: req, category: 'user', message: 'user account registration approvals successful. uid list: ' + uidList.toString()});
        return;
      });
    });
  });
  
  // create a new role
  app.post('/rolecreate', handy.user.requireAuthenticationStatus('authenticated'), handy.system.validateForm('roleCreate'), handy.user.checkPermission('system.System', ['Can alter system configuration']), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
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
      // combinedRRP is in the format role$*$resource$*$permission
      let separator = '$*$';  // separator used in the form
      var rrpArray = combinedRRP.split(separator);
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    // remove csrf token
    delete req.body._csrf;

    // set final redirect destination
    var destination = req.query.destination;
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
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    var update = {};
    // checkboxes are ommited from req.body when their value is false so need to add it back
    update.sitemapSubmit = req.body.sitemapSubmit === 'true' ? true : false;
    delete req.body.sitemapSubmit;  // remove from req.body before processing the rest of form

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
    
    update.sitemapConfig = {content: sitemapContent, default: sitemapDefault};
    handy.system.systemVariable.updateConfig(update, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error updating sitemap settings: ' + err.message);
      } else {
        handy.system.systemMessage.set(req, 'success', 'Sitemap settings successfully updated');
      }
      
      handy.system.redirectBack(0, req, res); // redirect to previous page
    });
  });


  // process robots.txt form 
  app.post('/robots', handy.system.validateForm('robotsForm'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    // delete csrf
    delete req.body._csrf;

    // process update
    var update = {};
    update.robotsTxt = req.body.robotsTxt;
    handy.system.systemVariable.updateConfig(update, function(err){
      if(err){
        handy.system.systemMessage.set(req, 'warn', 'Error updating robots.txt');
      } else {
        handy.system.systemMessage.set(req, 'success', 'Changes saved');
      }
      handy.system.redirectBack(0, req, res);  // redirect to previous page
    });
  });
  
  app.post('/contact', handy.system.validateForm('contactForm'), function(req, res){
    req.body = handy.utility.trimFormTextEntries(req.body); // trim text entries
    // contact form sunmissions are sent to the site admin (i.e. user with uid=1)
    var admin = new handy.user.User();
    admin.load(1, 'id', function(err){
      if(err){
        admin = null;  // free up memory
        handy.system.systemMessage.set(req, 'danger', 'Error sending message.  Please try again: ' + err.message);
        handy.system.redirectBack(0, req, res);
        handy.system.logger.record('error', {error: err, message: 'error sending contact message'});
        return;
      }
      var receipient = {email: admin.email};
      var sender = {name: handy.system.systemVariable.getConfig('siteName'), email: handy.system.systemVariable.getConfig('siteEmail')};
      var now = new Date();  
      var subject = '[' + handy.system.systemVariable.getConfig('siteName') + '] Contact Form from ' + now.toDateString();
      var body = {};
      body.text = 'Contact form submission\n\n';
      body.text += 'Name: ' + req.body.contact_name + '\n';
      body.text += 'Email: ' + req.body.contact_email + '\n'
      body.text += 'Message: ' + req.body.contact_message;
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
        handy.system.logger.record('info', {req: req, category: 'system', message: 'contact message sent'});
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
  let seed;  // this will contain all the information required to populate the content being created
  let type = req.params.type.toLowerCase();

  // check if user has permission to create the content
  handy.user.checkPermission(req.session.user.id, 'content.' + type, ['Can create new content', 'Can create draft content'], function(err, flag){
    if(err){
      handy.system.systemMessage.set(req, 'danger', 'Error creating a new ' + type + ': ' + err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      handy.system.logger.record('error', {error: err, message: 'Error creating new content: ' + type});
      return;
    }

    if(!flag){
      handy.system.systemMessage.set(req, 'danger', 'You are not authorized to create a new ' + type);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      handy.system.logger.record('warn', {req: req, category: 'content', message: 'user not authorized to create content: ' + type});
      return;
    }
  
    seed = req.body;
    seed.creator = req.session.user.id;
    seed.organization = req.session.user.organization || null;
    seed.category = seed.category === 'nocategoryselected' || seed.category === undefined ? null : parseInt(seed.category);
    
    // check if user is restricted to creating draft content, if so set content to draft
    handy.user.checkPermission(req.session.user.id, 'content.' + type, ['Can create new content'], function(err, flag){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error creating new ' + type + ': ' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        handy.system.logger.record('error', {error: err, message: 'Error checking user permission to create content. id: ' + seed.creator});
        return;
      }
      
      // if user does not have permission to create new content, set published to false
      if(!flag){seed.published = false; }
      
      handy.content.createContent(type, seed, function(err, newContent){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Error creating a new ' + type + ': ' + err.message);
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          handy.system.logger.record('error', {error: err, message: 'Error creating new content: ' + type});
          return;
        }
    
        handy.system.systemMessage.set(req, 'success', 'New ' + type + ' created');
        handy.system.logger.record('info', {req: req, category: 'content', message: 'new content created successfully. id: ' + seed.id + ' type: ' + seed.contenttype});
    
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
 * private function for app.post('/content/:type/:id/:action)
 * edits an existing  content object
 */
function _editExistingContent(req, res, destination){
  let uid = parseInt(req.session.user.id);
  let contentType = req.params.type.toLowerCase();
  let actionType = 'edit';
  let contentId = parseInt(req.params.id);
  let beginPath = '/' + contentType + '/';

  let newContent = handy.content.createNewInstance(contentType);

  // load from the database
  newContent.load(contentId, 'id', function(err){
    if(err){
      newContent = null;  // free up memory
      handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
      handy.system.redirectBack(0, req, res);  // redirect to previous page
      handy.system.logger.record('error', {error: err, message: 'Error loading content for editing. type: ' + contentType + ' id: ' + contentId});
      return;
    }

    // check if user has the permission to perform edit
    handy.user.checkUserHasSpecificContentPermission(req, res, uid, contentType, newContent.id, actionType, function(err, flag){
      if(err){
        handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        handy.system.logger.record('error', {error: err, message: 'Error editing content. type: ' + contentType + ' id: ' + newContent.id});
        newContent = null;  // free up memory
        return;
      }
    
      if(!flag){
        handy.system.systemMessage.set(req, 'danger', 'You do not have the permission to edit this ' + contentType);
        handy.system.redirectBack(0, req, res);  // redirect to previous page
        handy.system.logger.record('warn', {req: req, category: 'content', message: 'User does not have permission to edit content. type: ' + contentType + ' id: ' + newContent.id});
        newContent = null;  // free up memory
        return;
      }

      switch(contentType){
        case 'category':
          req.body.name = req.body.newCategoryName;
          req.body.parent = _.isNaN(parseInt(req.body.parentcategory)) ? null : parseInt(req.body.parentcategory);
          break;
        default:
          // ensure values are of the right type
          req.body.category = (req.body.category === 'nocategoryselected' || req.body.category === undefined) ? null : parseInt(req.body.category);
          req.body.published = req.body.published ? true : false;

          req.body.url = (req.body.url !== '' && typeof req.body.url !== 'undefined') ? beginPath + encodeURIComponent(req.body.url) : beginPath + encodeURIComponent(req.body.title);
          req.body.url = req.body.url.toLowerCase();
          req.body.url = req.body.url.replace(/%20/g, '-'); // replace spaces with dash signs
          break;
      }


      // update newContent with edited values
      _.forEach(req.body, function(value, parameter){
        parameter = parameter.toLowerCase();

        // some properties ie 'creator' & 'organization' are immutable
        const immutableProperties = ['creator', 'organization']; 
        let isImmutablePropertyFlag = immutableProperties.indexOf(parameter) < 0 ? false : true;
        newContent[parameter] = isImmutablePropertyFlag ? newContent[parameter] : value;  // need to ensure the values have been converted to the correct type prior to this
      });

      newContent.save(function(err){
        if(err){
          handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
          handy.system.redirectBack(0, req, res);  // redirect to previous page
          handy.system.logger.record('error', {error: err, message: 'Error saving edited content. type: ' + contentType + ' id: ' + newContent.id});
          newContent = null;  // free up memory
          return;
        }

        let categoryList = handy.system.systemVariable.getConfig('categoryList');
        switch(contentType){
          case 'category':
            categoryList[newContent.id] = {name: newContent.name, parent: newContent.parent};
            handy.system.systemVariable.updateConfig({categoryList: categoryList}, function(err){
              if(err){
                handy.system.systemMessage.set(req, 'danger', 'Error editing ' + contentType + ': ' + err.message);
                handy.system.redirectBack(0, req, res);  // redirect to previous page
                handy.system.logger.record('error', {error: err, message: 'Error updating system config for edited category. id: ' + newContent.id});
                newContent = null;  // free up memory
                return;
              }
              
              // redirect back (or go to the specified destination)
              handy.system.systemMessage.set(req, 'success', contentType + ' edit succesful');
              !destination ? handy.system.redirectBack(0, req, res) : res.redirect(destination);
              handy.system.logger.record('info', {req: req, category: 'content', message: 'category edited successfully. id: ' + newContent.id});
              newContent = null;  // free up memory
              return;
            });
            break;
          default:
            // redirect to view the content that was just edited (or the specified destination)
            handy.system.systemMessage.set(req, 'success', contentType + ' edit succesful');
            !destination ? res.redirect(newContent.url) : res.redirect(destination);
            handy.system.logger.record('info', {req: req, category: 'content', message: 'content editing succesful. type: ' + contentType + ' id: ' + newContent.id});
            newContent = null;  // free up memory
            return; 
            break;
        }
      });
    });
  });
}

/*
 * private function for app.post('/content/:type/:id/:action)
 * deletes an existing content object
 */
function _deleteExistingContent(req, res, destination){
  let uid = parseInt(req.session.user.id);
  let contentType = req.params.type.toLowerCase();
  let actionType = 'delete';
  let contentId = parseInt(req.params.id);
  destination = destination || '/welcomepage';

  loadContent(contentType, contentId)
  .then(checkUserPermissions)
  .then(deleteCategoryTypeContent)
  .then(deleteNonCategoryTypeContent)
  .then(sendResponseToUser)
  .catch(function(err){
    handy.system.systemMessage.set(req, 'danger', err.userMessage);
    handy.system.redirectBack(0, req, res);  // redirect to previous page
    handy.system.logger.record('error', {error: err.error, message: err.logMessage});
    return;
  });


  function loadContent(type, id){
    return new Promise(function(resolve, reject){
      let content = handy.content.createNewInstance(type);
      // get original values from database
      content.load(id, 'id', function(err){
        if(err){
          let userMessage = 'Error occured during ' + actionType + ' of ' + contentType + ': ' + err.message;
          let logMessage = 'Error loading ' + contentType + ' to be ' + actionType + '. id: ' + contentId;
          return reject({error: err, userMessage: userMessage, logMessage: logMessage}); 
        }

        resolve(content);
      });
    });
  }

  function checkUserPermissions(content){
    return new Promise(function(resolve, reject){
      handy.user.checkUserHasSpecificContentPermission(res, res, uid, contentType, content.id, actionType, function(err, permitted){
        if(err){
          let userMessage = 'Error occured during ' + actionType + ' of ' + contentType + ': ' + err.message;
          let logMessage = 'error checking permission for user to ' + actionType + ' ' + contentType + '. id: ' + contentId;
          return reject({error: err, userMessage: userMessage, logMessage: logMessage}); 
        }

        if(!permitted){
          let userMessage = 'You do not have permission to ' + actionType + ' this ' + contentType + ': ' + err.message;
          let logMessage = 'permission denied to delete ' + contentType + '. id: ' + contentId;
          return reject({error: new Error('user does not have permission to ' + actionType + ' this ' + contentType) , userMessage: userMessage, logMessage: logMessage}); 
        }
        // no errors and no permission problems
        resolve(content);
      });
    });
  }

  function deleteCategoryTypeContent(content){
    return new Promise(function(resolve, reject){
      // only run this for category content
      if(contentType !== 'category'){ return resolve(content); }
      _deleteCategoryAndChildren(content)
      .then(function(){
        return resolve(content);
      })
      .catch(function(err){
        let userMessage = 'Error deleting ' + contentType + ': ' + err.message;
        let logMessage = 'error deleting ' + contentType + ' and/or children. id: ' + contentId;
        return reject({error: err, userMessage: userMessage, logMessage: logMessage});
      });
    });
  }

  function deleteNonCategoryTypeContent(content){
    return new Promise(function(resolve, reject){
      // skip this for category content, another function 'deleteCategoryTypeContent' handles them
      if(contentType === 'category'){ return resolve(content); }

      content.delete(function(err){
        if(err){
          let userMessage = 'Error deleting ' + contentType + ': ' + err.message;
          let logMessage = 'error deleting ' + contentType + '. id: ' + contentId;
          return reject({error: err, userMessage: userMessage, logMessage: logMessage});
        }

        content.save(function(err){
          if(err){
            let userMessage = 'Error deleting ' + contentType + ': ' + err.message;
            let logMessage = 'error saving ' + contentType + ' while deleting. id: ' + contentId;
            return reject({error: err, userMessage: userMessage, logMessage: logMessage});
          }

          return resolve(content);
        })
      });
    });
  }

  function sendResponseToUser(content){
    return new Promise(function(resolve, reject){
      // redirect to welcomepage
      handy.system.systemMessage.set(req, 'success', contentType + ' succesfully deleted');
      res.redirect(destination);
      handy.system.logger.record('info', {req: req, category: 'content', message: content.contenttype + ' successfully deleted. id: ' + content.id});
      content = null;  // free up memory
      return resolve(content);
    })
  }

  // helper function for deleteCategoryAndChildren
  function _deleteCategoryAndChildren(category){
    // delete category
    // save deleted category record
    // delete corresponding categoryList entry
    // get children
    // repeat for each child
    return new Promise(function(resolve, reject){
      category.delete(function(err){
        if(err){ return reject(err); }

        category.save(function(err){
          if(err){ return reject(err); }

          _deleteCategoryListEntry(category)
          .then(_getChildren)
          .then(_recursivelyRepeatForChildren)
          .then(function(){
            return resolve();
          })
          .catch(function(err){
            reject(err);
          });
        });
      });
    });
  }

  function _deleteCategoryListEntry(category){
    return new Promise(function(resolve, reject){
      let categoryList = handy.system.systemVariable.getConfig('categoryList');
      delete categoryList[category.id];
      handy.system.systemVariable.updateConfig({categoryList: categoryList}, function(err){
        if(err){ return reject(err); }
        resolve(category);
      });
    });
  }

  function _getChildren(parent){
    return new Promise(function(resolve, reject){
      let categoryList = handy.system.systemVariable.getConfig('categoryList');
      let children = [];  // will contain all the childrent of parent
      _.forEach(categoryList, function(catDef, catId){
        if(parent.id === catDef.parent){ children.push({id: catId, def: categoryList[catId]}); }
      });

      resolve(children);
    });
  }

  function _recursivelyRepeatForChildren(children){
    return Promise.all(_.map(children, function(child){
      return new Promise(function(resolve, reject){
        let id = child.id;
        let childCategory = new handy.content.Category();
        childCategory.load(id, 'id', function(err){
          if(err){ return reject(err); }
          _deleteCategoryAndChildren(childCategory)
          .then(function(){
            return resolve();
          })
          .catch(function(_err){
            return reject(err);
          });
        });
      });
    }));
  }
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

  /* private function for '/userregister' and 'orgregister'
   * creates a new user account and performs redirects
   */
  function _registerUserAccount(req, res){
    return new Promise(function(resolve, reject){
      let destination = req.query.destination === undefined ? '/welcomepage' : req.query.destination;
      let newUser = new handy.user.User();
      newUser.register(req, (function(err, loginstatus){
        if(err){
          return reject(err);
        }
        let message;
        switch(loginstatus){
          case 'loggedin':
            // registration successful and new user has been logged in
            handy.system.systemMessage.set(req, 'success', 'New user registration successful');
            res.redirect(destination);
            handy.system.logger.record('info', {req: req, category: 'user', message: 'user registration successful. id: ' + newUser.id});
            newUser = null;  // free up memory
            return resolve();
            break;
          case 'notloggedin':
            // registration successful but new user is not logged in (usually because the account was created by another user who is currently loggedin or user needs to verify their email address)
            if(handy.system.systemVariable.getConfig('emailVerify')){
              message = 'Registration successful. Please check your email for instructions on how to complete your registration';
            } else {
              message = 'New user registration successful';
            }

            handy.system.systemMessage.set(req, 'success', message);
            handy.system.redirectBack(0, req, res);  // redirect to previous page
            handy.system.logger.record('warn', {req: req, category: 'user', message: 'user registration successful but welcome mail not sent. id: ' + newUser.id});
            newUser = null;  // free up memory
            return resolve();
            break;
        }
      }).bind(newUser));
    });
  }