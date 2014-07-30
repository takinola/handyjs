/*
 * Test suite for user file of handy.js
 */

var expect = require('expect.js')
  , handy = require('../lib/handy')
  , _ = require('underscore')
  , mysql = require('mysql')
  , async = require('async')
  ;

// test wide variables 
var testdb = 'testdb';
var password = 'my password';
var testUser = new handy.user.User();
testUser.name = 'test user';
testUser.email = 'test@user.com';

// set up dummy variable for req, res
var req = {
  session: {
    msgCache: {}
  }
};

var res = {};

describe('User.js test suite', function(){
  this.timeout(5000);
  
  before(function(done){
    // set up test database and pool
    var connectionOptions = {
      host: 'localhost',
      user: 'testuser',
      password: 'testpassword',
      connectionLimit: 100
    };
    
    var pool = mysql.createPool(connectionOptions);
   
    var query = 'CREATE DATABASE IF NOT EXISTS ' + testdb;
    pool.getConnection(function(err, connection){
      if(err){done(err);}
      connection.query(query, function(err, results){
        connection.release();
        if(err){done(err);}
        connectionOptions.database = testdb;
        pool = mysql.createPool(connectionOptions);
        handy.system.systemVariable.set('pool', pool);
        done();
      });
    }); 
  });
  
  before(function(done){
    // set up user table and save record
    var pool = handy.system.systemVariable.get('pool');
    testUser.createTable(pool, function(err){
      if(err){done(err);}
      testUser.hash(password, function(err){
        if(err){done(err);}
        testUser.save(pool, function(err){
          done(err);
        });
      });
    });
  });
  
  before(function(done){
    // set up role table, create join_role_user table
    var pool = handy.system.systemVariable.get('pool');
    // set up role table
    var testRole = new handy.user.Role();
    testRole.name = 'tester';
    testRole.createTable(pool, function(err){
      if(err){done(err);}
        
      // set up join_role_user table
      var query = 'CREATE TABLE IF NOT EXISTS join_role_user(';
      query += 'user_id INT NOT NULL, ';
      query += 'role_id INT NOT NULL, ';
      query += 'FOREIGN KEY fk_user(user_id) REFERENCES user(id) ON UPDATE CASCADE ON DELETE CASCADE, ';
      query += 'FOREIGN KEY fk_role(role_id) REFERENCES role(id) ON UPDATE CASCADE ON DELETE CASCADE';
      query += ')';
      
      pool.getConnection(function(err, connection){
        if(err){done(err);}
        connection.query(query, function(err, results){
          done(err);
        });
      });
    });
  });
  
  it('Check user function: hash', function(done){
    // test two scenarios (1) salt is provided (2) no salt is provided
    // save old salt and old hash so we do not mess up next set up tests
    var pool = handy.system.systemVariable.get('pool');
    var oldHash = testUser.passwordhash;
    var oldSalt = testUser.salt;
    testUser.passwordhash = undefined;
    testUser.salt = undefined;
    
    // test scenario 1
    testUser.salt = 'ksdsjdaojdaadu9qid02ie02';
    testUser.hash(password, function(err){
      if(err){done(err);}
      expect(testUser.passwordhash).to.not.be(undefined);
      
      // test scenario 2
      testUser.salt = undefined;
      testUser.passwordhash = undefined;
      testUser.hash(password, function(err){
        if(err){done(err);}
        expect(testUser.passwordhash).to.not.be(undefined);
        expect(testUser.salt).to.not.be(undefined);
        
        // reset values of passwordhash and salt
        testUser.passwordhash = oldHash;
        testUser.salt = oldSalt;
        done();
      });
    });
    
  });
  
  it('Check user function: load', function(done){
    var pool = handy.system.systemVariable.get('pool');
    var loadUser = new handy.user.User();
    var loadOptions = {id:testUser.id, email:testUser.email};  // test both ways to load user accounts
    var asyncFn = [];  // set up function array for async
    _.forEach(loadOptions, function(val, key){
      asyncFn.push(
        function(asyncCallback){
          loadUser.load(val, key, pool, function(err){
            // check that the saved record is the same as the retrieved record
            expect(loadUser.id).to.be(testUser.id);
            expect(loadUser.name).to.be(testUser.name);
            expect(loadUser.email).to.be(testUser.email);
            expect(loadUser.passwordhash).to.be(testUser.passwordhash);
            expect(loadUser.salt).to.be(testUser.salt);
            asyncCallback(err);
          });
        }
      );
    });
    
    async.series(asyncFn, function(err){
      done(err);
    });
  });
  
  it('Check user function: authenticate', function(done){
    var pool = handy.system.systemVariable.get('pool');
    var authUser = new handy.user.User();
    // try authenticating with the wrong password
    var wrongPass = password.substr(0, password.length-1);  // remove the last character
    authUser.authenticate(testUser.email, wrongPass, pool, function(err){
      expect(err).to.be.an('object')
      expect(authUser.authenticated).to.be(null);
      
      // try authenticating with the right password
      authUser.authenticate(testUser.email, password, pool, function(err){
        if(err){done(err);}
        expect(authUser.authenticated).to.be(true);
        done();
      });
    });
  });
  
  it('Check user function: cancelAccount', function(done){
    var pool = handy.system.systemVariable.get('pool');
    var cancelUser = new handy.user.User();
    // make a duplicate user record
    cancelUser.load(testUser.email, 'email', pool, function(err){
      if(err){done(err);}
      delete cancelUser.id;
      cancelUser.email = 'cancel@mail.com';
      cancelUser.save(pool, function(err){
        if(err){done(err);}
        expect(cancelUser.deleted).to.eql(false);
        
        // set not to send cancellation emails
        var config = handy.system.systemVariable.get('config');
        config.account_cancelled_checkbox = false;
        handy.system.systemVariable.set('config', config);
        
        // cancel user account
        cancelUser.cancelAccount(req, pool, function(err){
          if(err){done(err);}
          expect(cancelUser.deleted).to.eql(true);
          
          // check that the database record was truly cancelled
          var checkUser = new handy.user.User();
          checkUser.load(cancelUser.email, 'email', pool, function(err){
            if(err){done(err);}
            expect(checkUser.deleted).to.eql(true);
            done();
          });
        })
      });
    });
  });
  
  it('Check function: requireAuthenticationStatus', function(){
    var checkUser = new handy.user.User();
    checkUser.cloneObject(testUser);
    req.session.user = checkUser;
    var status = ['authenticated', 'unauthenticated'];
    var next = function(err){
      if(err){return false;}
      return true;
    };
    
    status.forEach(function(val, key){
      var result = handy.user.requireAuthenticationStatus(val)(req, res, next);
      if(val === 'authenticated'){expect(result).to.be(false);}
      if(val === 'unauthenticated'){expect(result).to.be(true);}
    });
    
    // set user as authenticated and run rest again
    req.session.user.authenticated = true;
    status.forEach(function(val, key){
      var result = handy.user.requireAuthenticationStatus(val)(req, res, next);
      if(val === 'unauthenticated'){expect(result).to.be(false);}
      if(val === 'authenticated'){expect(result).to.be(true);}
    });
  });
  /*
  it('Check functions: getUserRole', function(done){
    var pool = handy.system.systemVariable.get('pool');
    // create user and role, then save both records including the join table
    var roleUser = new handy.user.User();
    roleUser.cloneObject(testUser);
    roleUser.save(pool, function(err){
      if(err){done(err);}
      
      // create roles and save
      var roleArray = ['testRole1', 'testRole2', 'testRole3'];
      var asyncFn = [];
      roleArray.forEach(function(val, key){
        asyncFn.push(
          function(asyncCallback){
            var roleRole = new handy.user.Role();
            roleRole.name = val;
            roleRole.save(pool, function(err){
              if(err){asyncCallback(err);}
              
              // save user, role join
              handy.system.saveJoinTableRecord(roleUser, roleRole, pool, function(err){
                asyncCallback(err);
              });
            });
          }
        );        
      });
      
      async.parallel(asyncFn, function(err){
        if(err){done(err);}
        // read user roles
        handy.user.getUserRole(roleUser, function(err, roleList){
          if(err){done(err);}
          // convert roleList into a simple array of role names so it can be compared to roleArray
          var compareList = [];
          _.forEach(roleList, function(val, key){
            compareList.push(val.name);
          });
          
          // compare compareList to roleArray
          expect(_.difference(roleArray, compareList)).to.eql([]);
          expect(roleArray.length).to.be(compareList.length);
          done();
        });        
      });
    });
  });
  */
  it('Check function: requireRole', function(done){
    var pool = handy.system.systemVariable.get('pool');
    // create user, first and second role and save record
    var reqUser = new handy.user.User();
    reqUser.cloneObject(testUser);
    reqUser.save(pool, function(err){
      if(err){done(err);}
      var roleList = ['myRole1', 'myRole2'];
      var asyncFn = [];
      var myRole = [];
      roleList.forEach(function(val, key){
        asyncFn.push(
          function(asyncCallback){
            myRole[key] = new handy.user.Role();
            myRole[key].name = val;
            myRole[key].save(pool, function(err){
              asyncCallback(err);
            });
          }
        );
      });
      
      async.parallel(asyncFn, function(err){
        if(err){done(err);}
        
        // give user the first role
        handy.system.saveJoinTableRecord(reqUser, myRole[0], pool, function(err){
          // requireRole should return false for the second role
          var roleOptions = [myRole[1].name];
          req.session.user = reqUser; // set current user to reqUser
          handy.user.requireRole(roleOptions, function(err, result){
            if(err){done(err);}
            expect(result).to.be(false);
            
            // requireRole should return true for the first role
            roleOptions = [myRole[0].name];
            handy.user.requireRole(roleOptions, function(err, result){
              if(err){done(err);}
              expect(result).to.be(true);
              done();
            })(req, res);
            
          })(req, res);
        });
      });
    });
  });
  
  after(function(done){
    // clean up test database
    var pool = handy.system.systemVariable.get('pool');
    var query = 'DROP DATABASE ' + testdb;
    pool.getConnection(function(err, connection){
      if(err){expect().fail('error cleaning up the test database');}
      connection.query(query, function(err, results){
        if(err){expect().fail('error cleaning up the test database');}
        done();
      });
    });
  });
});