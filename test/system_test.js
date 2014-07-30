/*
 * Test suite for system file of handy.js
 */

var expect = require('expect.js')
  , handy = require('../lib/handy')
  , _ = require('underscore')
  , mysql = require('mysql')
  , async = require('async')
  ;
  
var objectInitializer = {
  id: 1,
  deleted: false
};

var schema = {tableName: 'systemtest'};
var testdb = 'testdb';
var testObject = new handy.system.BaseObject(objectInitializer, schema);

describe('System.js test suite', function(){
  this.timeout(5000);
  
  before(function(done){
    // set up test database
    var connectionOptions = {
      host: 'localhost',
      user: 'testuser',
      password: 'testpassword',
      connectionLimit: 100
    };
    
    
    var pool = mysql.createPool(connectionOptions);
    handy.system.systemVariable.set('pool', pool);
    var query = 'CREATE DATABASE IF NOT EXISTS ' + testdb;
    pool.getConnection(function(err, connection){
      if(err){done(err);}
      connection.query(query, function(err, results){
        connection.release();
        if(err){done(err);}
        done();
      });
    });
  });
  
  before(function(done){
    // set up test database
    var connectionOptions = {
      host: 'localhost',
      user: 'testuser',
      database: 'testdb',
      password: 'testpassword',
      connectionLimit: 100
    };
    
    // create siteconfig table.  stores all site configuration
    var query = 'CREATE TABLE IF NOT EXISTS siteconfig (';
    query += 'id INT(10) NOT NULL AUTO_INCREMENT, ';
    query += 'config VARCHAR(32767) NULL, ';
    query += 'PRIMARY KEY (id)';
    query += ')';
    
    var pool = mysql.createPool(connectionOptions);
    handy.system.systemVariable.set('pool', pool);
    pool.getConnection(function(err, connection){
      if(err){done(err);}
      connection.query(query, function(err, results){
        connection.release();
        if(err){done(err);}
        done();
      });
    });
  });

  it('Check systemVariable functions get, set, updateConfig and getConfig', function(){
    var pool = handy.system.systemVariable.get('pool');
    // test set & get functions
    var test = {test1: 20, test2: 'try'};
    _.forEach(test, function(val, key){
      handy.system.systemVariable.set(key, val);
    });
    
    _.forEach(test, function(val, key){
      expect(handy.system.systemVariable.get(key)).to.be(val);
    });
    
    // setting against reserved keys should throw an error
    test = {set: 10, get: 'try', getConfig: 'me', updateConfig: 30};
    _.forEach(test, function(val, key){
      expect(handy.system.systemVariable.set(key).toString()).to.be('Error: Error updating systemVariable: can\'t overwrite internal function');
    });
    
    // test updateConfig and getConfig
    var update = {
      one: 1,
      two: 'two',
    };
    
    handy.system.systemVariable.updateConfig(update, pool, function(err){
      if(err){expect().fail('error updating system configuration');}
      _.forEach(update, function(val, key){
        expect(handy.system.systemVariable.getConfig(key)).to.be(val);
      });
    });
  });
  
  
  it('Check BaseObject functions; set, get, delete, undelete, createTable', function(done){
    // check set, get,
    var test = {test1: 1, test2: 'try'};
    _.forEach(test, function(val, key){
      testObject.set(key, val, function(err){
        if(err){expect().fail('error with BaseObject.set');}
        expect(testObject.get(key)).to.be(val);
      });
    });
    
    // setting these values should fail since they should not pass validation
    var test = {id: 'number', createdate: '11/16/2012', modifydate: 'yesterday', deleted: 'of course'};
    
    _.forEach(test, function(val, key){
      testObject.set(key, val, function(err){
        expect(err).to.be.an('object');
      });
    });
  
    // test delete and undelete
    testObject.delete();
    expect(testObject.get('deleted')).to.be(true);
    testObject.undelete();
    expect(testObject.get('deleted')).to.be(false);  
 
    // test createTable
    var pool = handy.system.systemVariable.get('pool');
    testObject.createTable(pool, function(err){
      if(err){expect().fail('error creating tables');}
      var query = 'DESCRIBE ' + schema.tableName;
      pool.getConnection(function(err, connection){
        if(err){expect().fail('error getting pool connection');}
        connection.query(query, function(err, results){
          if(err){expect().fail('error running query: describe tablename');}
          // get list of fields
          var fieldList = [];
          results.forEach(function(val, key){
            fieldList.push(val.Field);
          });
          
          // check that each schema column is represented as a database table
          _.forEach(testObject.schema.columns, function(val1, key1){
            expect(fieldList).to.contain(key1);
          });
          done();
        });
      });
    });
  });
  
  it('Check BaseObject functions: cloneObject, save and load', function(done){
    var pool = handy.system.systemVariable.get('pool');
    var cloneObject = {
      deleted: true,
      permissions: 'yes please',
      schema: {tableName: 'cloneTable'}
    };
    // store previos values
    var schema = testObject.schema;
    
    testObject.cloneObject(cloneObject);
    expect(testObject.deleted).to.be(cloneObject.deleted);
    expect(testObject.permissions).to.be(cloneObject.permissions);
    expect(testObject.schema.tableName).to.be(schema.tableName); // schema should not have changed
    
    // save object
    testObject.save(pool, function(err){
      if(err){expect().fail('error with save function');}

      // load object from database..
      var newObject = new handy.system.BaseObject(null, schema);
      newObject.load(testObject.id, 'id', pool, function(err){
        if(err){expect().fail('error loading from database');}
 
        //... compare to original
        expect(newObject.id).to.eql(testObject.id);
        expect(newObject.deleted).to.eql(testObject.deleted);
        done();
      });
      
    });
  });
  
  it('Check join table functions: saveJoinTableRecord, readJoinTableRecord, removeJoinTableRecord', function(done){
    // create join tables
    var pool = handy.system.systemVariable.get('pool');
    var init = {deleted: false};
    var schema1 = {tableName: 'first'};
    var schema2 = {tableName: 'second'};
    var first = new handy.system.BaseObject(init, schema1);
    var second = new handy.system.BaseObject(init, schema2);
    
    // prepare function list for async
    var asyncFnList = [];
    // add functions to create the reference tables
    var objectList = [first, second];
    objectList.forEach(function(val, key){
      asyncFnList.push(
        (function(asyncCallback){
          this.createTable(pool, (function(err){
            if(err){asyncCallback(err);}
            this.save(pool, (function(err){
              // if all goes as planned, both first and second objects should be updated at this point
              asyncCallback(err);
            }).bind(this));
          }).bind(this))
        }).bind(val)
      );
    });
    
    // add function to create join table
    asyncFnList.push(
      function(asyncCallback){
        // doing a quick and dirty query to create the database join table.  The proper code that would take any objects would be too long and does not really add value (except future flexibility)
        var query = 'CREATE TABLE IF NOT EXISTS ';
        query += 'join_first_second(';
        query += 'first_id INT NOT NULL, ';
        query += 'second_id INT NOT NULL, ';
        query += 'PRIMARY KEY (first_id, second_id), ';
        query += 'FOREIGN KEY fk_first(first_id) REFERENCES first(id) ON UPDATE CASCADE ON DELETE CASCADE, ';
        query += 'FOREIGN KEY fk_second(second_id) REFERENCES second(id) ON UPDATE CASCADE ON DELETE CASCADE';
        query += ')';
        var pool = handy.system.systemVariable.get('pool');
        pool.getConnection(function(err, connection){
          if(err){asyncCallback(err);}
          connection.query(query, function(err, results){
            connection.release();
            asyncCallback(err);
          });
        });
      }
    );
    
    async.series(asyncFnList, function(err){
      if(err){done(err);}
      // test saveJoinTableRecord
      var pool = handy.system.systemVariable.get('pool');
      handy.system.saveJoinTableRecord(second, first, pool, function(err){
        if(err){done(err);}
        // read join record
        handy.system.readJoinTableRecord(first, second, pool, function(err, results){
          if(err){done(err);}
          results.forEach(function(val, key){
            val.forEach(function(val1, key1){
              expect(val1).to.have.property('table');
              expect(val1).to.have.property('record');
              val1.table === first.schema.tableName ? expect(val1.record[val1.table].id).to.be(first.id) : expect(val1.record[val1.table].id).to.be(second.id);
              val1.table === first.schema.tableName ? expect(val1.record[val1.table].deleted).to.eql(first.deleted) : expect(val1.record[val1.table].deleted).to.eql(second.deleted);
            });
          });
          // remove join record
          handy.system.removeJoinTableRecord(second, first, pool, function(err){
            if(err){done(err);}
            var query = 'SELECT * FROM join_first_second';
            pool.getConnection(function(err, connection){
              if(err){done(err);}
              connection.query(query, function(err, newresults){
                expect(newresults.length).to.be(0);
                done();
              });
            });
          });
        })
      });
    });
  });
  
  it('Check functions: validateForm', function(){
    // set up test form.  need to use dummy variables for req since there is no actual user request
    var formType = 'testValidation';
    var formInput = {};
    var req = {
      session:{
        msgCache:{}
      }
    };
    // form input scenarios that should return success
    formInput.success = {
        requiredText: {
          value: 'some text',
          required: true,
          type: 'text'
        },
        notRequiredText: {
          value: '',
          required: false,
          type: 'text'
        },
        maxLengthText: {
          value: '123456',
          type: 'text',
          maxlength: 7
        },
        goodEmail: {
          value: 'a@b.c',
          type: 'email',
        },
        goodURL: {
          value: 'https://test.com',
          type: 'url'
        },
        plainNumber: {
          value: 9,
          type: 'number'
        },
        minMaxNumber: {
          value: 5,
          min: 2,
          max: 7,
          type: 'number'
        },
        noValidate: {
          value: 'do not validate this',
          type: 'text',
          maxlength: 2,
          novalidate: true
        }
      };
      
      formInput.fail = {
        missingText: {
          value: '',
          required: true,
          type: 'text',
        },
        tooLongText: {
          value: '12345',
          type: 'text',
          maxlength: 3
        },
        badEmail: {
          value: 'a@',
          type: 'email'
        },
        badUrl: {
          value: 'htt://test.com',
          type: 'url',
        },
        lowNumber: {
          value: 9,
          type: 'number',
          min: 10,
        },
        highNumber: {
          value: 13,
          type: 'number',
          max: 12,
        },
        notNumber: {
          value: 'nine',
          type: 'number',
        },
      };
    
    _.forEach(formInput, function(val, key){
      req.validateObject = val;
      expect(handy.system.validateForm('testValidation')(req)).to.be(key);
    });
  });
  
  it('Check systemMessage functions: set and get', function(){
    // set up dummy variable for req
    var req = {
      session: {
        msgCache: {}
      }
    };
    var messageType = []
    , message = []
    ;
    messageType[0] = 'testmessage_1';
    message[0] = 'This is a test_1';
    messageType[1] = 'testmessage_2';
    message[1] = 'This is a test_2';
    
    messageType.forEach(function(val, key){
      handy.system.systemMessage.set(req, messageType[key], message[key]);
    });
    
    var clearFlag = false;  // do not delete the message after getting
    messageType.forEach(function(val, key){
      expect(handy.system.systemMessage.get(req, messageType[key], clearFlag)[messageType[key]]).to.eql([message[key]]);
    });
      
    clearFlag = true;
    messageType.forEach(function(val, key){
      expect(handy.system.systemMessage.get(req, messageType[key], clearFlag)[messageType[key]]).to.eql([message[key]]);
      expect(handy.system.systemMessage.get(req, messageType[key], clearFlag)[messageType[key]]).to.be(undefined);
    });
  });
  
  it('Check tokenReplace function', function(){
    // set up req, user and systemVariable
    var user = new handy.user.User();
    user.id = 1;
    user.name = 'test user';
    user.email = 'test@user.com';
    user.onetimelink = 'qwerttyuio';
    
    var req = {};
    req.session = {user: user};
    req.protocol = 'https';
    req.host = 'test.com';
    req.url = 'test/path.htm';
    
    var siteName = 'Test Site';
    handy.system.systemVariable.set('config', {siteName: siteName});  // we can't use updateConfig because we would need to set up a database and pool and so on, so short-cutting it here
    
    var messages = [
      {
        token: '[date:current]',
        expected: ''
      },
      {
        token: '[time:current]',
        expected: ''
      },
      {
        token: '[current-page:url]',
        expected: req.protocol + '://' + req.host + '/' + req.url
      },
      {
        token: '[current-page:url:path]',
        expected: req.url
      },
      {
        token: '[current-page:url:relative]',
        expected: '/' + req.url
      },
      {
        token: '[user:email]',
        expected: user.email
      },
      {
        token: '[user:name]',
        expected: user.name
      },
      {
        token: '[user:one-time-login-url]',
        expected: req.protocol + '://' + req.host + '/onetimelogin?email=' + encodeURIComponent(user.email) + '&link=' + encodeURIComponent(user.onetimelink)
      },
      {
        token: '[user:cancel-url]',
        expected: req.protocol + '://' + req.host + '/accountcancel?email=' + encodeURIComponent(user.email) + '&link=' + encodeURIComponent(user.onetimelink)
      },
      {
        token: '[user:one-time-email-verification-url]',
        expected: req.protocol + '://' + req.host + '/verifyemail?email=' + encodeURIComponent(user.email) + '&link=' + encodeURIComponent(user.onetimelink)
      },
      {
        token: '[site:name]',
        expected: siteName
      },
      {
        token: '[site:url]',
        expected: req.protocol + '://' + req.host
      },
      {
        token: '[site:login-url]',
        expected: req.protocol + '://' + req.host + '/login'
      },
    ];
    
    messages.forEach(function(val, key){
      if(val.expected !== ''){
        expect(handy.system.tokenReplace(val.token, req, user)).to.be(val.expected);
      }
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