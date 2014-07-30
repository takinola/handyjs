/*
 * Test suite for utility file of handy.js
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

describe('Utility.js test suite', function(){
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
  
  it('Check function: removeLastCharacter', function(){
    // test the followin scenarios (1) remove single character (2) remove multiple character string (3) attempt to remove unknown character
    
    // scenario 1
    var testString = 'ttfyghhkjjihiugyftfghbhuhbygyggtesojjb6';
    var removeString = testString.substr(testString.length-1);
    var result = handy.utility.removeLastCharacter(removeString, testString);
    expect(result).to.be(testString.substr(0,testString.length-1));
    
    // scenario 2
    removeString = 'UN1QUE_STR!NG';
    // insert removeString somewhere in testString
    var insertPosition = Math.floor(Math.random() * (testString.length + 1));
    var newString = testString.substr(0, insertPosition) + removeString + testString.substr(insertPosition);
    result = handy.utility.removeLastCharacter(removeString, newString);
    expect(result).to.be(testString);
    
    // scenario 3
    testString = 'Does not have parenthesis anywhere in it';
    removeString = '()';
    result = handy.utility.removeLastCharacter(removeString, testString);
    expect(result).to.be(testString);
  });
  
  it('Check function: checkUniqueRecord', function(done){
    var pool = handy.system.systemVariable.get('pool');
    // save multiple user records with different email addresses
    var uniqueEmail = ['one', 'two', 'three', 'four'];
    var asyncFn = [];
    var uniqueUser = [];
    uniqueEmail.forEach(function(val, key){
      asyncFn.push(
        function(asyncCallback){
          uniqueUser[key] = new handy.user.User();
          uniqueUser[key].cloneObject(testUser);
          delete uniqueUser[key].id;
          uniqueUser[key].email = val;
          uniqueUser[key].save(pool, function(err){
            asyncCallback(err);
          });  
        }
      );
    });
    
    async.parallel(asyncFn, function(err){
      if(err){done(err);}
      // check uniqueness of one of the email addresses
      var randomEmailPos = Math.floor(Math.random() * (uniqueEmail.length+1));
      var recordToTest = {column: 'email', value: uniqueEmail[randomEmailPos]};
      var expectedRecord = {column: 'email', value: uniqueEmail[randomEmailPos]};
      var table = 'user';
      handy.utility.checkUniqueRecord(recordToTest, expectedRecord, table, pool, function(err, uniqueFlag){
        if(err){done(err);}
        expect(uniqueFlag).to.be(true);
        uniqueFlag = null;  // prevent contamination
        
        // try again without specifying the expectedRecord, should return false
        handy.utility.checkUniqueRecord(recordToTest, table, pool, function(err, uniqueFlag){
          if(err){done(err);}
          expect(uniqueFlag).to.be(false);
          done();
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