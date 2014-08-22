/*
 * Functionality to manage and define users
 */

var utility = require('./utility')
  , system = require('./system')
  , content = require('./content')
  , _ = require('underscore')
  , crypto = require('crypto')
  , async = require('async')
  , Acl = require('acl')
  ;
  
  // setup redis backend for Acess Control List
  //var client = require('redis').createClient(6379, '127.0.0.1', {no_ready_check: true, auth_pass: 'Rwe45ji*9o3QdET967gHJDw@tMId'});
  var client = require('redis').createClient(6379, '127.0.0.1', {no_ready_check: true});
  var acl = new Acl(new Acl.redisBackend(client, 'acl_'));
  
  exports.acl = acl;  // make acl available to other modules
  
  
/*
 * define user object
 * @param {object} init - initializing properties for the new object instance
 * @param {object} schema - database schema for added properties
 */
exports.User = User;

function User(init, schema){
  // set defaults for init and schema
  init = (init !== undefined && init !== null) ? init : {};
  schema = (schema !== undefined && schema !== null) ? schema : {};
  
  var user_init = {
    name: null,
    email: null,
    passwordhash: null,
    salt: null,
    lastlogin: null,
    authenticated: null,
    verified: false,
    creator: null,
    onetimelink: null,
    onetimelinktimestamp: null,
    role:[]
  };
  
  var user_schema = {
    tableName: 'user',
    columns: {
      name: {type: 'VARCHAR', size: 256, null: true},
      email: {type: 'VARCHAR', size: 256, null: false},
      passwordhash: {type: 'VARCHAR', size: 512, null: false},
      salt: {type: 'VARCHAR', size: 512, null: false},
      lastlogin: {type: 'DATETIME', null: true},
      verified: {type: 'BOOL', null: false, default: false},
      creator: {type: 'INT', size: 10, null: true, foreignkey:{name:'fk_user', reference:{table: 'user', column: 'id'}, onupdate: 'CASCADE', ondelete: 'CASCADE'}},
      onetimelink: {type: 'VARCHAR', size: 512, null: true},
      onetimelinkhash: {type: 'VARCHAR', size: 512, null: true},
      onetimelinktimestamp: {type: 'DATETIME', null: true, default: 'CURRENT_TIMESTAMP'},
      role: {type: 'VARCHAR', size: 512, null: true}
    }
  };
  
  // include the additional properties and schema
  _.forEach(init, function(val, key){
    user_init[key] = val;
  });
  
  _.forEach(schema, function(val, key){
    user_schema[key] = val;
  });

  system.BaseObject.call(this, user_init, user_schema);
}

utility.subClass(system.BaseObject, User);


/*
 * Custom load function for user is required
 * for use case where user is retrieved by email
 * not just id
 *
 * @param {int/string} id - unique identifier of the user record
 * @param {string} type - type of identifier i.e 'email' or 'id'
 * @api public
 */
User.prototype.load = function(id, type, callback){
  system.genericLoad.bind(this, id, type, (function(err){
    if(err){return callback(err);}
    
    // convert role from string back to array
    this.role = JSON.parse(this.role);
    return callback(null);
    
  }).bind(this))();
} 


/*
 * generate password hash with optional salt
 * if salt is not provided, generate one
 *
 * @param {string} pwd - password to be hashed
 * @api public
 */
User.prototype.hash = function(pwd, callback){
  var len = 128;
  var iterations = 12000;

  if(this.salt !== undefined && this.salt !== null){
    crypto.pbkdf2(pwd, this.salt, iterations, len, (function(err, hash){
      this.passwordhash = (new Buffer(hash, 'binary')).toString('base64');
      return callback(err, this.salt, this.passwordhash);
    }).bind(this));
  } else {
      crypto.randomBytes(len, (function(err, salt){
        if(err){ return callback(err);}
        this.salt = salt.toString('base64');
        crypto.pbkdf2(pwd, this.salt, iterations, len, (function(err, hash){
          if(err){ return callback(err);}
          this.passwordhash = (new Buffer(hash, 'binary')).toString('base64');
          return callback(null, this.salt, this.passwordhash);
        }).bind(this));
      }).bind(this));
  }
}


/*
 * authenticate user based on email and password combination
 * NOTE: authentication does not create a session for the user.  It only
 * checks the validity of the email/password combination. If you
 * want to create a user session, use function 'login' (after authentication
 * of course)
 *
 * @param {string} email - user email
 * @param {string} password - user provided unhashed password
 * @api public
 */
User.prototype.authenticate = function(email, password, callback){  
  this.load(email, 'email', (function(err){
    if(err){return callback(err);}
    // create temp user object and copy all properties of current user to it
    var testuser = new User();
    testuser.cloneObject(this);

    testuser.hash(password, (function(err, salt, pwdhash){
      if(err){testuser=null; return callback(err);}
      if(testuser.passwordhash === this.passwordhash){
        this.set('authenticated', true, function(err, usr){
          testuser = null;  // free up memory
          return callback(null, usr);
        });
      } else {
        testuser = null; // free up memory
        return callback(new Error('authenticate: invalid email/password combination'));
      }
    }).bind(this));
  }).bind(this));
} 


/*
 * login user (assuming post authentication)
 *
 * @param {object} req - express request object
 * @api public
 */
User.prototype.login = function(req, callback){
  var loginRole = ['authenticated'];  // role given to every user upon successful login
  // ensure user is active and authenticated
  if(this.deleted){return callback(new Error('login: user account inactive'));}
  //if(!this.verified){return callback(new Error('Your email needs to be verified before you can login.  \nPlease click on the verification link in the email sent to you or <a class="alert-link" href="/requestverificationemail?type=email&email=' + encodeURIComponent(User.email) + '">request another verification email</a> be sent to you'));}
  if(!this.authenticated){return callback(new Error('login: please authenticate your account before loggin in'));}

  var pool = system.systemVariable.get('pool');

  req.session.regenerate((function(){
    req.session.user = this;
    // update last login record for user
    pool.getConnection((function(err, connection){
      this.lastlogin = new Date();
      var query = "UPDATE user SET lastlogin = " + connection.escape(this.lastlogin) + ' WHERE id = ' + connection.escape(this.id);
      connection.query(query, (function(err, results){
        connection.release();
        if(err){err.message = 'Error saving user account'; return callback(err);}
        
        // assign roles to user
        // this not only allows the use of the 'authenticated' role but also mitigates the corruption
        // of the Redis managed access control system since the user roles are restored every time
        // they log in
        this.assignRole(this.role.concat(loginRole), function(err){
          if(err){err.message = 'Error assigning role ' + loginRole + ' to user account'; return callback(err);}
          return callback(null);          
        });
      }).bind(this)); 
    }).bind(this));
  }).bind(this));
}


/*
 * logout user
 *
 * @param {object} req - express request object
 * @api public
 */
User.prototype.logout = function(req, callback){
  req.session.destroy((function(){
    // remove authenticated role
    this.unAssignRole(['authenticated'], function(err){
      callback(err);
    });
  }).bind(this));
}


/*
 * create one time link used for email verification or password rest
 *
 * @param {string} type - type of one time link, options are 'email', 'password'.
 *                        option email generates one-time links that can only be used for email verification
 *                        option password generates one-time links that can only be used for password modification e.g forgot password
 * @api public
 */
User.prototype.createOneTimeLink = function(type, callback){
  /* 
   * create a 32 digit salt (which is the one-time link) and use that to generate a hash of the request type 
   * ('email' or 'password'). This means that the one-time link is crytographically random and will only
   * validate against its own type i.e. you can't use an email verification on-time link to perform a password
   * change or vice versa
   */
  
  var len = 32;
  var iterations = 12000;
  var now = new Date();
  
  crypto.randomBytes(len, (function(err, salt){
    if(err){return callback(err);}
    this.onetimelink = salt.toString('base64');
    crypto.pbkdf2(type, this.onetimelink, iterations, len, (function(err, hash){
      if(err){return callback(err);}
      this.onetimelinkhash = (new Buffer(hash, 'binary')).toString('base64');
      this.onetimelinktimestamp = now;
      return callback(null);
    }).bind(this));
  }).bind(this));
}


/*
 * verify one-time link
 * this function verifies the one-time link supplied by the user is correct and has not expired
 * if verification is successful, the one-time link is nulled out (to ensure it can only be used once)
 * returns a verification flag (and the user object details if the verification is successful)
 * return values are 'user not found', 'no previous request', 'link expired', 'match failed' & 'success'
 *
 * @param {string} type - type of one-time link.  options are 'email' (for email verification) or password (for password resets)
 * @param {string} link - user supplied link to be tested
 * @param {int} daysToExpiry - (optional) length of time in days for the link to be considered expired.  0 means never expires 
 * @api public
 */
User.prototype.verifyOneTimeLink = function(type, link, daysToExpiry, callback){
  // set daysToExpiry to 1 day if not specified
  if (arguments.length === 3){
    callback = expiryPeriod;
    daysToExpiry = 1;
  }
  // set daysToExpiry to infinity if set to 0
  daysToExpiry = daysToExpiry === 0 ? Number.MAX_VALUE : daysToExpiry;
  
  var verifyFlag;
  
  // load the user details from database
  this.load(this.email, 'email', (function(err){
    if(err){
      // if user is not found, set verifyFlag
      if(err.message === 'user not found'){
        verifyFlag = 'user not found';
        return callback(null, verifyFlag);
      }
      // if other error, return the error
      return callback(err);
    }  
    // check if user has one-time link
    if(!this.onetimelink){
      verifyFlag = 'no previous request';
      return callback(null, verifyFlag);
    }
    
    // validate hash
    var len = 32;
    var iterations = 12000;
    
    crypto.pbkdf2(type, link, iterations, len, (function(err, hash){
      if(err){err.message = 'system error'; return callback(err);}
      var testHash = (new Buffer(hash, 'binary')).toString('base64');
      // check if hashes match
      if (this.onetimelinkhash === testHash){
        // if hashes match, check if the one-time link has not expired
        var now = new Date();
        var then = new Date(this.onetimelinktimestamp);
        var elapsedDays = (now - then) / (1000 * 60 * 60 * 24);
        if(elapsedDays > daysToExpiry){
          verifyFlag = 'link expired';
          return callback(null, verifyFlag);
        }
        verifyFlag = 'success';
        // null out the one-time link so it cannot be used again
        this.onetimelink = null;
        this.onetimelinktimestamp = null;
        this.onetimelinkhash = null;
        
        // account is now verified
        this.verified = true;
        
        // update the user record
        this.save(function(err){
          if(err){err.message = 'error updating the user record.  please retry'; return callback(err);}
          return callback(null, verifyFlag, this);
        });
      } else {
        verifyFlag = 'match failed';
        return callback(null, verifyFlag, this);
      }
    }).bind(this));
  }).bind(this));
}


/*
 * create new user account
 * if registration is successful, returns calllback(null, 'loggedin') if new user is logged in, 
 * returns callback(null, 'notloggedin') otherwise
 * all users are automatically assigned to "authenticated" role upon successful registration
 *
 * @param {object} req - express request object
 * @api public
 */
User.prototype.register = function(req, callback){
  
  // initialize user initiating registration request i.e. administrator or visitor
  var requestingUser = new User();
  // set id of requesting user to null (i.e. user is self-registering).  if the registration is initiated by a logged in user, the logged in user's id will overwrite the null setting in the next step
  requestingUser.id = null;
  
  // if current user is logged in, make them the requesting user
  if(req.session.user.id > 0){
    _.forEach(req.session.user, function(val, key){
      requestingUser[key] = val;
    });
  }
  // check current user has the correct permissions
  _checkCurrentUserHasRegisterPermissions.bind(this)(req, (function(err, check){
    if(err){return callback(err);}
    if(!check){
      var error = new Error('Permission denied');
      error.message = 'You do not have permission to register a new user account';
      return callback(error);
    }

    // populate the new user with details
    _populateNewUserDetails.bind(this)(req, requestingUser, (function(err){
      if(err){return callback(err);}
      // check if account already exists
      _checkUserAccountAlreadyExists.bind(this)((function(err, accountExistsFlag){

        if(err){return callback(err);}
        if(accountExistsFlag){
          var error = new Error();
          error.message = 'an account with these credentials already exists';
          return callback(error);
        }

        // set verification flag on user account i.e. flag that determines if to request email address verification or admin approval
        _setVerificationFlagOnUserAccount.bind(this)();
        // determine if a one-time link is needed
        var oneTimeLinkType;
        switch(this.didNotChooseOwnPassword){
          case true:
            // generate a 'password' one-time link
            oneTimeLinkType = 'password';
            break;
          case false:
            switch(this.verified){
              case true:
                // no one-time link is needed since the user chose their own password and their email is already verified
                oneTimeLinkType = 'none';
                break;
              case false:
                // generate an 'email' one-time link
                oneTimeLinkType = 'email';
                break;
            }
            break;
        }

        // generate activation links (one time login or email verification link), as needed
        if(oneTimeLinkType !== 'none'){
          this.createOneTimeLink(oneTimeLinkType, (function(err){
            if(err){return callback(err);}
            _saveUserSendRegistrationNotificationsandFinalizeProcessing.bind(this)(req, function(err, loginstatus){
              if(err){return callback(err);}
              return callback(null, loginstatus);
            });
          }).bind(this));
        } else {
          // skip one-time link creation
          _saveUserSendRegistrationNotificationsandFinalizeProcessing.bind(this)(req, function(err, loginstatus){
            if(err){return callback(err);}
            return callback(null, loginstatus);
          });
        }
      }).bind(this));
    }).bind(this));
  }).bind(this));
}


/*
 * initiate a password reset e.g. user has forgotten their password and needs a password reset link sent to them
 * 
 * @param {object} req - express request object
 * @api public
 */
User.prototype.initiatePasswordReset = function(req, callback){
  // get user details from database
  this.load(this.email, 'email', (function(err){
    if(err){err.message = 'unable to find user record'; return callback(err);}
    
    // create one-time link
    this.createOneTimeLink('password', (function(err){
      if(err){err.message = 'user record reset link could not be created'; return callback(err);}
      
      // save one-time link
      this.save((function(err){
        if(err){err.message = 'user record could not be updated.'; return callback(err);}
        
        // send password reset link to user
        var receipient = {name: this.name, email: this.email};
        var sender = {name: system.systemVariable.getConfig('siteName'), email: system.systemVariable.getConfig('siteEmail')};
        var subject = system.tokenReplace(system.systemVariable.getConfig('password_recovery_subject'), req, this);
        var body = system.tokenReplace(system.systemVariable.getConfig('password_recovery_body'), req, this);
        
        system.sendEmail(receipient, sender, subject, body, function(err, message){
          if(err){err.message = 'password reset instructions could not be sent'; return callback(err);}
          
          return callback(null);
        });
      }).bind(this));
    }).bind(this));
  }).bind(this));
}


/*
 * cancel user account
 *
 * @param {object} req - express request object
 * @api public
 */
User.prototype.cancelAccount = function(req, callback){
  /* admin user #1 account can never be cancelled.  This is to prevent the situation where 
   * a sole admin mistakenly cancels their own account and the site is stranded without an admin
   */
  if(this.id === 1){
    system.systemMessage.set(req, 'danger', 'Account of site owner cannot be cancelled');
    return callback(new Error('this account cannot be cancelled'));
  }
  
  this.delete();
  // remove all roles so that if the user account is ever undeleted, someone has to thoughtfully reassign roles
  this.role = [];
  this.save((function(err){
    if(err){err.message = 'error saving user account'; return callback(err);}
    
    // send account cancellation email, if required
    if(system.systemVariable.getConfig('account_cancelled_checkbox')){
      var receipient = {name: this.name, email: this.email};
      var sender = {name: system.systemVariable.getConfig('siteName'), email: system.systemVariable.getConfig('siteEmail')};
      var subject = system.tokenReplace(system.systemVariable.getConfig('account_cancelled_subject'), req, this);
      var body = system.tokenReplace(system.systemVariable.getConfig('account_cancelled_body'), req, this);     
      system.sendEmail(receipient, sender, subject, body, function(err, message){
        if(err){
          system.systemMessage.set(req, 'danger', 'Account cancelled but confirmation email could not be sent');
          return callback(null);
        } else {
          system.systemMessage.set(req, 'success', 'Account succesfully cancelled');
          return callback(null); 
        }
      });
    } else {
      system.systemMessage.set(req, 'success', 'Account succesfully cancelled');
      return callback(null); 
    }
  }).bind(this));
}


/*
 * change password on user account
 * currently there are two scenarios
 * (1) change - the user is aware of their current password but wants to change it
 * (2) reset - the user is unaware of their current password and wants to choose another one (e.g. first time
 * login after an account has been created for you or when you reset your password)
 *
 * @param {string} type - type of password change scenario ("change" or "reset")
 * @param {string} oldPassword - (optional, not required for type "reset") current password
 * @param {string} newPassword - new password 
 * @param {object} req - express request object
 * @api public
 */
User.prototype.changePassword = function(type, oldPassword, newPassword, req, callback){
  // take care of scenario where oldPassword is omitted from arguments
  if(arguments.length === 4){
    newPassword = oldPassword;
    req = newPassword;
    callback = req;
  }
  
  /* Need to figure out the best way to handle flow logic where the outermost function with a lot
   * of nested callbacks may not be required.  Right now, the method being used is to encapsulate 
   * the nested callbacks in an external function and then use a switch/case for the topmost function
   */
  switch(type.toLowerCase()){
    case 'change':
      //  user knows their current password but wants a new one
      // check old password to see if it is correct
      this.authenticate(this.email, oldPassword, (function(err){
        if(err){err.message = 'Current password entered is incorrect'; return callback(err);}
        
        // create a new password hash, save the user record, login the user (in case they were not previously loggedin)
        _createNewHashSaveUserLoginUser.bind(this)(newPassword, req, function(err, loggedinstatus){
          return callback(err, loggedinstatus);
        });
      }).bind(this));
      break;
    case 'reset':
      // user does not know or has forgotten their current password and wants a new one (user's identity must be  authenticated in some other fashion to ensure account integrity).  Typically, this happens when a user requests a password reset and so clicks on a one-time link
      
      // create a new password hash, save the user record, login the user (in case they were not previously loggedin)
      _createNewHashSaveUserLoginUser.bind(this)(newPassword, req, function(err, loggedinstatus){
        return callback(err, loggedinstatus);
      });
      break;
    default:
      var newErr = new Error('password reset type not recognized');
      return callback(newErr);
  }
}


/*
 * Assign a role to the user
 * NOTE: All roles are lowercased by convention (i.e. "ABCD" === "abcd")
 * Also, the role will be automatically created if it does not already exist
 * 
 * @param {array} role - array of roles to which the user is being assigned
 * @api public
 */
User.prototype.assignRole = function(role, callback){
  // check if user id is set
  if(typeof this.id !== 'number'){
    var err = new Error('user requires an id before being assigned to a role');
    return callback(err);
  }
  
  role = utility.convertCase(role, 'toLowerCase');
  
  var asyncFn = [
    _assignRoleInMemory.bind(this, role),
    _assignRoleInDb.bind(this, role)
  ];
  
  async.parallel(asyncFn, function(err){
    return callback(err);
  });
  
  function _assignRoleInMemory(newRole, asyncCallback){
    // assign the role to the user
    acl.addUserRoles(this.id, newRole, function(err){
      asyncCallback(err);
    });    
  }
  
  function _assignRoleInDb(newRole, asyncCallback){
    var updateRole = [];

    // add the new roles to the existing ones
    updateRole = _.union(utility.convertCase(this.role, 'toLowerCase'), newRole);
 
    // stop processing if user already had all the new roles
    if(this.role.length === updateRole.length){asyncCallback(null); return;}
    
    this.role = updateRole;
    this.save(function(err){
      if(err){asyncCallback(err);}
      asyncCallback(null);
    });
  }
}


/*
 * Unassign a role from a user
 * NOTE: All roles are lowercased by convention (i.e. "ABCD" === "abcd")
 *
 * @param {array} role - roles from which the user is being unassigned
 * @api public
 */
User.prototype.unAssignRole = function(role, callback){
  // check if user id is set
  if(typeof this.id !== 'number'){
    var err = new Error('user requires an id');
    return callback(err);
  }
  
  role = utility.convertCase(role, 'toLowerCase');
  
  var asyncFn = [
    _unAssignRoleInMemory.bind(this, role),
    _unAssignRoleInDb.bind(this, role)
  ];
  
  async.parallel(asyncFn, function(err){
    return callback(err);
  });

  
  function _unAssignRoleInMemory(role, asyncCallback){
    // unassign the role to the user
    acl.removeUserRoles(this.id, role, function(err){
      asyncCallback(err);
    });    
  }
  
  function _unAssignRoleInDb(role, asyncCallback){
    // check to see if the user already has the role
    var tempArray = [];
    
    // find out which roles the user does not have already
    var tempArray = _.difference(utility.convertCase(this.role, 'toLowerCase'), role)
    
    // if the user did not have any of the roles then stop processing
    if(this.role.length === tempArray.length){asyncCallback(null);}
    
    // update the user roles
    this.role = tempArray;
    this.save(function(err){
      if(err){asyncCallback(err);}
      asyncCallback(null);
    });
  }
}


// create a new password hash, save the user record and login the user (private function for user.prototype.changePassword)
function _createNewHashSaveUserLoginUser(newPassword, req, callback){
  // create a new password hash
  this.hash(newPassword, (function(err){
    if(err){console.log('hash err:', err); err.message = 'Password change failed'; return callback(err);}
    
    // save user record
    this.save((function(err){
      if(err){console.log('save err:', err);err.message = 'Password change failed'; return callback(err);}
      
      // login user (just in case they are not already)
      this.authenticated = true;
      this.login(req, function(err){
        if(err){return callback(null, 'notloggedin');}
        
        return callback(null, 'loggedin');
      });
    }).bind(this));
  }).bind(this));
};

// check current user has the right permissions to register new users
function _checkCurrentUserHasRegisterPermissions(req, callback){
  switch(system.systemVariable.getConfig('registerAuthority').toLowerCase()){
    case 'administrator':
      acl.userRoles(req.session.user.id, function(err, roles){
        if(err){return callback(err);}
        var flag = false;
        roles.forEach(function(item){
          if(item.toLowerCase() === 'administrator'){
            flag = true;
          }
        });
        return callback(null, flag);
      });
      break;
    case 'visitor':
    case 'requireadmin':
      // anyone can register a new account
      return callback(null, true);
  }
}

// populate new user object with data
function _populateNewUserDetails(req, requestingUser, callback){
  // minimum requirements if for an email address to be provided
  if(!req.body.userEmail){
    var error = new Error();
    error.message = 'please provide an email address';
    return callback(error);
  }
  
  // if no user name is provided, generate one from the email address
  if(req.body.userName){
    this.name = req.body.userName;
  } else {
    var locationof = req.body.userEmail.indexOf('@');
    this.name = req.body.userEmail.substr(0, locationof);
  }
  this.email = req.body.userEmail;
  this.authenticated = false;
  this.verified = false;
  this.creator = requestingUser.id;
  this.lastlogin = new Date();
  this.createdate = new Date();
  
  // if no password is provided, generate one
  if(req.body.userPassword){
    this.password = req.body.userPassword;
    this.didNotChooseOwnPassword = false;
  } else {
    this.password = Math.random().toString(36).slice(-8);
    // set a flag to indicate the user did not choose this password and hence must be sent a notification that sends them to a one-time-login-link (which makes you choose a new password)
    this.didNotChooseOwnPassword = true;
  }
  
  // if the password was not self-supplied (e.g. account created by admin), set didNotChooseOwnPassword to true.  this enables a one-time link to be generated a sent to the user so they can choose their own password
  if(requestingUser.id !== null){
    this.didNotChooseOwnPassword = true;
  }
  
  // generate salt and passwordhash
  this.hash(this.password, function(err, salt, passwordhash){
    if(err){return callback(err);}
    return callback(null);
  })
}

// check if the user being registered already has an account
function _checkUserAccountAlreadyExists(callback){
  // try to load a user with the same email from the database
  this.load(this.email, 'email', function(err){
    if(err){
      // if error type is 'not found' then user account does not already exist
      if(err.message === 'not found'){return callback(null, false);}
    }
    
    // all other cases, either return the error or state that the user was found to already exist
    return callback(err, true);
  });
}

// set verification flag on user account i.e. flag that determines if request email verification or admin verification is required
function _setVerificationFlagOnUserAccount(){
  switch (system.systemVariable.getConfig('registerAuthority').toLowerCase()){
    case 'administrator':
      // account created by administrator.  no verification necessary
      this.verified = true;
      break;
    case 'visitor':
      // no verification necessary if email verification flag is not set
      if(!system.systemVariable.getConfig('emailVerify')){
        this.verified = true;
      }
      break;
    case 'requireadmin':
      // do nothing, the email verification will be sent when the administrator approves the account request
      // this.verified is false by default
      break;
  
  return;
  }
}


/* clumsy function created because I could not figure out how to put an asynchronous function with a callback 
 * into an if/else statement i.e. the callback needs to run regardless of if the parent asynchronous function gets
 * called or not.  The problem is how to write this without writing the entire callback twice (once in each 
 * leg of the if/else statement)
 *
 * This function saves the user record to the database, sends registration notifications and does final processing
 */
function _saveUserSendRegistrationNotificationsandFinalizeProcessing(req, callback){
  // save user record to database
  this.save((function(err){
    if(err){return callback(err);}          
    // send notifications
    _sendRegistrationNotifications.bind(this)(req, (function(err){
      if(err){return callback(err);}
 
      // end processing
      _endRegistrationProcessing.bind(this)(req, (function(err, loginstatus){ 
        if(err){return callback(err);}
        return callback(null, loginstatus);
      }).bind(this));
    }).bind(this));
  }).bind(this));
}

/* 
 * notify user (and admin, if necessary) about account reqgistration
 *
 * @param {object} req - request object
 * @api private
 */ 
function _sendRegistrationNotifications(req, callback){
  var receipient
  , sender
  , subject
  , body
  ;

  receipient = {name: this.name, email: this.email};
  sender = {name: system.systemVariable.getConfig('siteName'), email: system.systemVariable.getConfig('siteEmail')};

  switch (system.systemVariable.getConfig('registerAuthority').toLowerCase()){
    case 'administrator':
      subject = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_admin_subject'), req, this);
      body = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_admin_body'), req, this);
      break;
    case 'visitor':
      // if user did not choose their own password, then send them a notification that contains a one-time link
      if(this.didNotChooseOwnPassword){
        subject = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_admin_subject'), req, this);
        body = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_admin_body'), req, this);
      } else {
       
        switch (this.verified){
          case true:
            // user email address is already verified so send them a regular welcome message
            subject = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_no_approval_required_subject'), req, this);
            body = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_no_approval_required_body'), req, this);
            break;
          case false:
            // user has yet to verify their email address so send them a welcome email with an email verification link
            subject = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_email_verification_required_subject'), req, this);
            body = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_email_verification_required_body'), req, this);
            break;
        }
        
      }
      break;
    case 'requireadmin':
      subject = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_approval_required_subject'), req, this);
      body = system.tokenReplace(system.systemVariable.getConfig('welcome_new_user_approval_required_body'), req, this);
      break;
  }

  // send notification email
  system.sendEmail(receipient, sender, subject, body, function(err, message){
    if(err){return callback(err);}
    return callback(null);
  });
}


// final step in user registration - e.g. assign role and login user 
function _endRegistrationProcessing(req, callback){
  // set appropriate roles and publish any draft content the user may have created
  postUserVerificationProcessing([this.id], (function(err){
    if(err){return callback(err);}
    // if the registration is being initiated by an existing user, then just end processing without logging in the new user
    if(req.session.user.id > 0){return callback(null, 'notloggedin');}
    
    // if registration is being initiated by a visitor, then login the newly registered user (if admin approval is not required and user has already verified their account)
    if(req.session.user.id === 0){
      switch(system.systemVariable.getConfig('registerAuthority').toLowerCase()){
        case 'visitor':
          /*
          // if email verification is required, end processing without loggin in the new user
          if(system.systemVariable.getConfig('emailVerify')){
            return callback(null, 'notloggedin');
          }
          */
          // log in user
          //console.log('logging in new user\n', this);
          this.authenticated = true;
          this.login(req, function(err){
            if(err){return callback(err);}
            return callback(null, 'loggedin');
          });
          break;
        case 'requireadmin':
          return callback(null, 'notloggedin');
          break;
      }
    }
  }).bind(this));
  
  /************************************************************
  var initialRole = this.verified ? 'member' : 'unverified'; // verified users become members, otherwise get role unverified
  this.assignRole([initialRole], (function(err){
    if(err){return callback(err);}
    
    
    // if the registration is being initiated by an existing user, then just end processing without logging in the new user
    if(req.session.user.id > 0){return callback(null, 'notloggedin');}
  
    // if registration is being initiated by a visitor, then login the newly registered user (if admin approval is not required and user has already verified their account)
    if(req.session.user.id === 0){
      switch(system.systemVariable.getConfig('registerAuthority').toLowerCase()){
        case 'visitor':
          // log in user
          this.authenticated = true;
          this.login(req, function(err){
            if(err){return callback(err);}
            return callback(null, 'loggedin');
          });
          break;
        case 'requireadmin':
          return callback(null, 'notloggedin');
          break;
      }
    }
  }).bind(this));
*************************************************************************/
}


/*
 * check authentication status of current user session
 *
 * @param {string} status - authentication status to verify (options 'authenticated' or 'unauthenticated')
 * @api public
 */

exports.requireAuthenticationStatus = requireAuthenticationStatus;

function requireAuthenticationStatus(status){
  return function(req, res, next){
    switch (status.toLowerCase()){
      case 'authenticated':
        if (req.session.user && req.session.user.id > 0 && req.session.user.authenticated === true){
          return next();
        }
        break;
      case 'unauthenticated':
        if (!req.session.user || req.session.user.id === 0 || req.session.user.authenticated !== true){
          return next();
        }
        break;
    }

    system.systemMessage.set(req, 'danger', 'You are not authorized to do that!  Please <a class="alert-link" href="/contact">contact</a> us if you think this message is in error.');
    var error = new Error('not authorized');
    error.status = 403;
    return next(error);
  }
}


/*
 * approve user registration requests
 * this function sets each account verified flag to true
 *
 * @param {array} uidList - list of ids for users pending registration to be approved
 * @param {object} req - express request object
 * @api public
 */
exports.approveAccountRegistrationRequest = approveAccountRegistrationRequest;

function approveAccountRegistrationRequest(uidList, req, callback){
  // end processing if uidList is empty
  if(uidList.length === 0){
    error = new Error();
    error.message = 'No accounts found for approval';
    return callback(err);
  }
  
  // set up function list for async.parallel
  var functionList = [];
  uidList.forEach(function(val, key){
    functionList.push(
      function(asyncCallback){
        var approvedUser = new User();
        approvedUser.id = val;
        approvedUser.load(approvedUser.id, 'id', (function(err){
          if(err){
            err.message = 'Error loading user ' + this.id;
            approvedUser = null;  // free up memory
            asyncCallback(err);
          }
          this.verified = true;
          
          // generate onetime link
          this.createOneTimeLink('password', (function(err){
            if(err){
              err.message = 'Error creating one-time login link';
              approvedUser = null;  // free up memory
              asyncCallback(err);
            }
            // save changes
            this.save((function(err){
              if(err){
                err.message = 'Error saving user ' + this.id;
                approvedUser = null;  // free up memory
                asyncCallback(err);
              }
              
              /* perform post account verification processes 
               * (i.e. set appropriate roles and publish all draft content)
              */
              postUserVerificationProcessing([this.id], (function(err){
                if(err){
                  err.message = 'Error occured with post verification processing';
                  approvedUser = null; // free up memory
                  asyncCallback(err);
                }
                
                // send approval notification to user, if necessary
                if(system.systemVariable.getConfig('account_activation_checkbox')){
                  // set up email
                  var receipient = {name: this.name, email: this.email};
                  var sender = {name: system.systemVariable.getConfig('siteName'), email: system.systemVariable.getConfig('siteEmail')};
                  var subject = system.tokenReplace(system.systemVariable.getConfig('account_activation_subject'), req, this);
                  var body = system.tokenReplace(system.systemVariable.getConfig('account_activation_body'), req, this);
              
                  // send email
                  system.sendEmail(receipient, sender, subject, body, (function(err, message){
                    if(err){
                      err.message = 'Error sending message to user ' + this.id
                      approvedUser = null;  // free up memory
                      asyncCallback(err);
                    }
                
                    approvedUser = null;  // free up memory
                    asyncCallback(null);
                  }).bind(this));
                } else {
                  asyncCallback(null);
                }
              }).bind(this));
            }).bind(this));
          }).bind(this));
        }).bind(approvedUser));
      }
    );
  });
  
  async.parallel(functionList, function(err, results){
    if(err){return callback(err);}
    return callback(null);
  });
}


/*
 * Check the user has the appropriate permissions to perform a task
 * NOTE: This function works as both middleware or as a straight function.
 * To access the straight functionality, include a callback function which
 * will be returned as callback(err, status) with 'status' indicating whether
 * permission was granted or not
 *
 * @param {int} userId - user id for user whose permissions are being checked - optional
 * @param {string} resource - resource being checked for permission to access
 * @param {array} task - array of tasks being checked for permission to perform.  tasks are OR'ed (i.e. return true if permission exists for just one of the tasks)
 * @param {object} req - express request object
 * @param {object} res - express response object
 * @api public
 */
exports.checkPermission = checkPermission;

function checkPermission(userId, resource, task, callback){  
  /* NOTE: When this function is called as middleware, these variables (middleware, task, resource) are set for each 
   * route when the server starts and will never change during future runtime.  This took hours of painful debugging 
   * to discover so be sure to understand this if making any changes to this function
   */
  var middleware = typeof callback !== 'undefined' ? false : true;
  if(middleware){
    task = resource;
    resource = userId;
  }
  return function(req, res, next){
    var uId = middleware ? req.session.user.id : userId;
    uId = uId || 0;  // set uId to 0 if undefined

    // convert all to lowercase
    resource = resource.toLowerCase();
    task = utility.convertCase(task, 'toLowerCase');
    
    _checkIfUserHasAdminRole(function(err, flag){
      _checkIfUserIsAllowed(err, flag, function(err, response){
        _responseType(err, response);
      });
    });
    
    
    function _checkIfUserHasAdminRole(clbk){
      acl.userRoles(uId, function(err, currentRoles){
        if(err){return clbk(err);}
        var flag = false;
        currentRoles.forEach(function(role){
          if(role.toLowerCase() === 'administrator'){flag = true;}
        });
        return clbk(null, flag);
      });
    }
    
    function _checkIfUserIsAllowed(err, preFlag, clbk){
      if(err){return clbk(err);}
      if(preFlag){return clbk(null, true);}
      //console.log('checking uId:' + uId + '\nresource:' + resource + '\ntask:' + task);
      var asyncFn = [];
      task.forEach(function(subTask){
        asyncFn.push(
          function(asyncCallback){
            acl.isAllowed(uId, resource, subTask, function(err, result){
              asyncCallback(err, result);
            });
          }
        );
      });
      
      async.parallel(asyncFn, function(err, finalResult){
        var flag = false;
        finalResult.forEach(function(subResult){
          if(subResult === true){flag = true;}
        });
        return clbk(err, flag);
      });
      
      /*
      acl.isAllowed(uId, resource, task, function(err, result){
        if(err){return clbk(err);}
        return clbk(null, result);
      });
      */
    }
    
    function _responseType(err, finalFlag){
      switch(middleware){
        case true:
          if(err){return next(err);}
          if(finalFlag){return next();}
          var newError = new Error('user not authorized');
          newError.status = 403;
          return next(newError);
          break;
        case false:
          if(err){return callback(err);}
          return callback(null, finalFlag);
          break;
      }
    }
  }
}


/* Check if user has the permission to modify/delete this specific content i.e. they have permission
 * to modify/delete all content or in the case where this content belongs to them, they have permission
 * to modify/delete their own content
 *
 * @param {object} req - express request object
 * @param {object} res - express response object
 * @param {integer} uid - user id
 * @param {string} contentType - content type
 * @param {integer} urlId - content id
 * @param {string} actionType - type of action being performed i.e. 'edit' or 'delete'
 * @api public
 */
exports.checkUserHasSpecificContentPermission = checkUserHasSpecificContentPermission;

function checkUserHasSpecificContentPermission(req, res, uid, contentType, urlId, actionType, callback){
  // set up resource, tasks
  var resource
    , taskGeneral
    , taskSpecific
    ;
  
  resource = 'content.' + contentType;
  
  switch(actionType.toLowerCase()){
    case 'edit':
      taskGeneral = 'Can modify any content';
      taskSpecific = 'Can modify own content only';
      break;
    case 'delete':
      taskGeneral = 'Can delete any content';
      taskSpecific = 'Can delete own content only';
      break;
  }
  
  // check if user has blanket permission to edit content
  checkPermission(uid, resource, [taskGeneral], function(err, result){
    if(err){return callback(err);}
    
    // user has blanket permission to edit content so display edit form
    if(result){
      return callback(null, true);
    }
    
    // if user does not have blanket permission to edit content check if they have specific permission on this content
    if(!result){
      checkPermission(uid, resource, [taskSpecific], function(err, result2){
        if(err){return callback(err);}
        if(!result2){return callback(null, false);}
        // user has edit own content permission but is this their own content?
        var newContent = content.createNewInstance(contentType);
        //var newContent = new content[contentType.substr(0,1).toUpperCase() + contentType.substr(1).toLowerCase()]();
        
        newContent.load(urlId, 'id', (function(err){
          if(err){newContent = null; return callback(err);}
          if(this.creator !== uid){newContent = null; return callback(null, false);}
          
          // ok, user is the owner of this content and has permission to edit own content
          return callback(null, true);
          
        }).bind(newContent));
      })(req, res);
    }
  })(req, res);
}


/*
 * Update resource permissions for roles
 * NOTE: Updates replace any previous permission settings for each role / resource
 * e.g. if role A has permission b on resource c, updating permission d on the same role / resource relationship
 * will result in permission b being removed.  In order, to add permissions, both current and new permissions must
 * be provided.
 *
 * @param {array} roleResourcePermissionList - array of role resource permission objects used to perform update
 *         format [{role: myrole, resource: myresource, permissions: [list of permissions]}, {...}, {...}]
 */
exports.updateRolePermission = updateRolePermission;

function updateRolePermission(roleResourcePermissionList, clbk){
  /* For performance reasons, all changes to memory are made first and followed by a single database update
   */

  var rolesPermissionGrant = system.systemVariable.getConfig('rolesPermissionGrant');
  
  var asyncFn = [
    _removeExistingPermissions.bind(null, rolesPermissionGrant, roleResourcePermissionList),
    _addNewPermissionsToMemory,
    _updatePermissionsToDatabase
  ];
  
  async.waterfall(asyncFn, function(err){
    clbk(err);
  });
  
  // clear role / resource realtionships in anticipation of update
  function _removeExistingPermissions(rolesPermissionGrant, roleResourcePermissionList, callback){
    var asyncFn = [];
    
    _.forEach(rolesPermissionGrant, function(resourcePermissionObject, role){
      if(role.toLowerCase() !== 'administrator'){
        rolesPermissionGrant[role] = {};
        
        // set up async function to remove resource permissions from memory
        _.forEach(resourcePermissionObject, function(permissionArray, resource){
          asyncFn.push(
            function(asyncCallback){
              acl.removeAllow(role, resource, permissionArray, function(err){
                asyncCallback(err);
              });
            }
          );
        });
      }
    });
    
    async.parallel(asyncFn, function(err){
      callback(err, roleResourcePermissionList, rolesPermissionGrant);
    });
  }
  
  // update permissions in memory and prep update of database
  function _addNewPermissionsToMemory(roleResourcePermissionList, rolesPermissionGrant, callback){
    var asyncFn = [];
    
    roleResourcePermissionList.forEach(function(roleResourcePermissionObject){
      
      // add resource permission relationship to database object
      var role = roleResourcePermissionObject.role;
      var resource = roleResourcePermissionObject.resource;
      var permissions = roleResourcePermissionObject.permissions;
      
      rolesPermissionGrant[role] = rolesPermissionGrant[role] || {};
      rolesPermissionGrant[role][resource] = permissions;
      
      // set up async function to add resource permission to memory
      asyncFn.push(
        function(asyncCallback){
          acl.allow(role, resource, permissions, function(err){
            asyncCallback(err);
          });
        }
      );
    });
    
    async.parallel(asyncFn, function(err){
      callback(err, rolesPermissionGrant);
    });
    
  }
  
  // update database with new permissions
  function _updatePermissionsToDatabase(rolesPermissionGrant, callback){
    system.systemVariable.updateConfig({rolesPermissionGrant: rolesPermissionGrant}, function(err){
      callback(err);
    });
  }
}


/*
 * Create a new role which may be assigned to users
 *
 * @param {string} newRole - new role to be created (will be lowercased)
 * @api public
 */

exports.createRole = createRole;

function createRole(newRole, callback){
  newRole = newRole.toLowerCase();  // all role names are lowercased by convention
  var roles = system.systemVariable.getConfig('rolesPermissionGrant');

  // check if newRole already exists, if so terminate
  if(roles.hasOwnProperty(newRole)){
    return callback(null);
  }
  
  // add new role to roles list
  roles[newRole] = {};
  
  // update config in database
  system.systemVariable.updateConfig({rolesPermissionGrant: roles}, function(err){
    return callback(err);
  });
}


/*
 * Delete a role so it can no longer be assigned to users
 *
 * @param {string} role - name of role to be deleted
 * @api public
 */
exports.deleteRole = deleteRole;

function deleteRole(role, callback){
  role = role.toLowerCase(); // all role names are lowercased by convention
  
  // terminate processing if administrator role is being deleted
  if(role === 'administrator'){return callback(new Error('administrator role may not be deleted'));}
  
  var asyncFn = [
    _removeRoleFromMemory.bind(null, role),
    _removeRoleFromConfig.bind(null, role)
  ];
  
  async.parallel(asyncFn, function(err){
    return callback(err);
  });
  
  // delete the role from system memory
  function _removeRoleFromMemory(role, asyncCallback){
    acl.removeRole(role, function(err){
      asyncCallback(err);
    });
  }
  
  // delete the role from system configuration
  function _removeRoleFromConfig(role, asyncCallback){
    // check if role even exists
    var currentRoles = system.systemVariable.getConfig('rolesPermissionGrant');
    if(!currentRoles.hasOwnProperty(role)){return asyncCallback(null);}
    delete currentRoles[role];
    system.systemVariable.updateConfig({rolesPermissionGrant: currentRoles}, function(err){
      asyncCallback(err);
    });
  }
}


/*
 * Reset access control system
 * Access control settings are maintained in the Redis database
 * however, it is possible for the Redis db to become corrupted or 
 * deleted.  In the case of such an event, this function will restore
 * the access control settings.
 *
 * @api public
 */
exports.aclReset = aclReset;

function aclReset(callback){
  var asyncFn = [
    initializePermissionGrants,
    _initializeUserRoleAssignment
  ];
  
  async.series(asyncFn, function(err){
    callback(err);
  });
  
}

/*
 * Initialize permission grants to various roles
 * This function is a bit more complex than it probably needs to be
 * Basically, it takes the list of resources and associated permissions and grants all to the administrator role
 * then, it goes through each other role and grants them requested permissions.
 * Complexity arrises from the following:
 *  - Need to get all the resources and permissions and before assigning to administrator
 *  - Short hand used for setting permissions for roles (i.e. [*] role and ['all'] permissions require some parsing)
 *  - [*] role means any roles with ['all'] permissions get the associated permissions automatically
 * Also, all roles, resources and tasks are lowercased (i.e. 'ABCD' === 'abdc')
 *
 * @api public
 */
exports.initializePermissionGrants = initializePermissionGrants;

function initializePermissionGrants(callback){
  var rolesObject = system.systemVariable.getConfig('rolesPermissionGrant');
  var permissionsObject = system.systemVariable.getConfig('resourcePermissionList');
  var resourceObject = [];  // will contain the settings for all resource permissions
  var unauthenticatedRole = ['unauthenticated'];  // roles to be assigned to users with id=0 i.e. unauthenticated users
  var unauthenticatedUserId = 0;  // id that represents an unauthenticated user
  
  _.forEach(permissionsObject, function(permissionList, resourcePrefix){
    _.forEach(permissionList, function(permissions, resourceSuffix){
      // skip resources identified as '*'.  these are only there to provide the general permissions available to all resources in this group
      if(resourceSuffix !== '*'){
        // set admin permissions
        var resourceName = resourcePrefix + '.' + resourceSuffix;
        // get unique list of permissions for administrator and convert to lowercase
        permissionList['*'] = permissionList['*'] || [];  // initialize array if it does not exist
        var adminPermissions = _.union(permissionList['*'], permissions);
        
        resourceObject.push(
          {
            roles: ['administrator'],
            allows: [
              {resources: resourceName.toLowerCase(), permissions: utility.convertCase(adminPermissions, 'toLowerCase')}            
            ]
          }
        );
        
        // set permissions for other roles
        _.forEach(rolesObject, function(resourcePermissionObject, role){
          // check to ensure the resource matches the current one
          _.forEach(resourcePermissionObject, function(permissionArray, resource){
            if(resource === resourceName){
              // skip the administrator role since that is already taken care of
              var rolePermission;
              if(role !== 'administrator'){
              
                resourceObject.push(
                  {
                    roles: [role.toLowerCase()],
                    allows: [
                      {resources: resourceName.toLowerCase(), permissions: utility.convertCase(permissionArray, 'toLowerCase')}
                    ]
                  }
                );
              }              
            }
          });
        });
      }
    });
  });
  
  // set accumulated access control parameters
  acl.allow(resourceObject, function(err){
    if(err){return callback(err);}
    // assign all unauthenticated users to role 'unauthenticated'
    acl.addUserRoles(unauthenticatedUserId, unauthenticatedRole, function(err){
      return callback(err);
    });
  });
}

/*
 * re-grant roles to users
 * This function takes every active user and reassigns them their roles
 *
 * @api private
 */
function _initializeUserRoleAssignment(callback){
  // read all active users from database and assign them all their roles
  var pool = system.systemVariable.get('pool');
  pool.getConnection(function(err, connection){
    if(err){return callback(err);}
    var query = connection.query('SELECT id FROM user WHERE deleted = FALSE');
    var ctr = 0;
    var bufferSize = 5;  // number of records to receive before processing
    var buffer = [];  // will contain results as they come in
    query
    .on('error', function(err){
      return callback(err);
    })
    .on('result', function(row){
      buffer.push(row['id']);  // save result in buffer
      ctr++;
      ctr = ctr % bufferSize;
      if(ctr === 0){
        connection.pause();  // stop reading new records
        _assignRoles(buffer, function(err){
          buffer = [];  // reset buffer
          connection.resume();  // resume reading new records
          if(err){return callback(err);}
        });
      }
      
    })
    .on('end', function(){
      connection.release();
      // process items still in buffer
      _assignRoles(buffer, function(err){
        buffer = [];
        return callback(err);
      });
    });
  });
  
  function _assignRoles(idArray, callback){
    if(idArray.length < 1){return callback();}
    
    var asyncFn = [];
    idArray.forEach(function(uid){
      asyncFn.push(
        function(asyncCallback){
          var assignee = new User();
          assignee.load(uid, 'id', (function(err_1){
            if(err_1){return asyncCallback(err_1);}
            this.assignRole(this.role, function(err_2){
              assignee = null; // free up memory
              if(err_2){return asyncCallback(err_2);}
              asyncCallback();
            });
          }).bind(assignee));
        }
      );
    });
    
    async.parallel(asyncFn, function(err){
      callback(err);
    });
  }
}


/*
 * post user verification processing
 * performs a number of tasks whenever a user account has been verified
 * this function should be called each time a user account is verified
 *
 * @param {array} uidList - array of ids of users that have been verified
 * @api public
 */
exports.postUserVerificationProcessing = postUserVerificationProcessing;

function postUserVerificationProcessing(uidList, callback){
  if(uidList.length === 0){return callback();}  // stop processing if no uids sent
  var asyncFn = [];
  uidList.forEach(function(id){
    asyncFn.push(
      function(asyncCallback){
        _processSinglePostUserVerification(id, function(err){
          asyncCallback(err);
        });
      }
    );
  });
  
  async.parallel(asyncFn, function(err){
    return callback(err);
  });
  
  
  function _processSinglePostUserVerification(id, clbk){
    var verifiedRole = ['verified'];  // role to be assigned to verified users
    
    var verifyUser = new User();
    verifyUser.load(id, 'id', function(err){
      if(err){verifyUser = null; return clbk(err);}
      // check if user is truly verified
      if(!verifyUser.verified){verifyUser = null; return clbk(null);}
      
      // user is really verified so assign verified role
      verifyUser.assignRole(verifiedRole, function(err){
        if(err){verifyUser = null; return clbk(err);}
        
        // publish all previously unpublished content
        var asyncFn_1 = [];
        var contentTypeList = system.systemVariable.getConfig('contentTypeList');  // list of all content type
        delete contentTypeList.Category;  // categories are not a content type so get rid of them
        Object.keys(contentTypeList).forEach(function(type){
          asyncFn_1.push(
            function(asyncCallback_1){
              _publishUserContent(type.toLowerCase(), verifyUser.id, function(err){
                asyncCallback_1(err);
              });
            }
          );
        });
        
        async.parallel(asyncFn_1, function(err){
          verifyUser = null; // free up memory
          clbk(err);
        });
      });
    });
  }
  
  function _publishUserContent(contentType, uid, clbk2){
    var criteria = {
      creator: uid,
      published: false
    };
    var maxContentCount = 5000;  // maximum number of content to publish. set to arbitrarily high number
    
    var options = {limit: {offset: 0, count: maxContentCount}};
    content.findContent(contentType.toLowerCase(), criteria, options, function(err, results){
      if(err){return clbk2(err);}
      if(results.length === 0){return clbk2();}
      // set all returned content to published
      var asyncFn2 = [];
      results.forEach(function(contentInfo){
        // set published to true and save each content
        asyncFn2.push(
          function(asyncCallback2){
            var newContent = content.createNewInstance(contentInfo.contenttype.toLowerCase());
            _.forEach(contentInfo, function(val, key){
              newContent[key] = val;
            });
            newContent.publish();
            newContent.save(function(err){
              newContent = null; // free up memory
              asyncCallback2(err);
            });
          }
        );
      });
      
      async.parallel(asyncFn2, function(err){
        clbk2(err);
      });
    });
  }
  
}