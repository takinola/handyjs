/*
 * Utility functions
 */

var _ = require('underscore')
  , util = require('util')
  , system = require('./system')
  ;

/*
 * create subclasses that inherit from superclass
 */
exports.subClass = subClass;

function subClass(superClass, subClass){
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  return;
}


/*
 * used to populate attributes of new object instances by iterating
 * over an initializing object which contains all the attributes
 * i.e. send in an object like {key1: val1, key2: val2} and the 
 * created object instance will have this.key1 = val1 and this.key2 = val2
 */
exports.populateNewObject = populateNewObject;

function populateNewObject(obj){
  _.forEach(obj, function(val, key){
    this[key] = val;
  }, this);
}

 /*
  * Test functionality
  */
exports.test = test;

function test(){

}


/*
 * Remove last occurence of a character
 * Particularly useful to remove trailing comma from strings generated
 * in loops e.g. "string1, string2, string3,"
 *
 * @param {string} char - character or string to be removed
 * @param {string} string - string to be modified
 * @api public
 */
exports.removeLastCharacter = removeLastCharacter;

function removeLastCharacter(char, string){
  var pos = string.lastIndexOf(char);
  // if char is not found in string, then return string unchanged
  if(pos === -1){return string;}
  
  var len = char.length;
  string = string.substr(0,pos) + string.substr(pos+len);
  return string; 
}


/*
 * Escape string characters to be used as literal string within a regular expression
 *
 * @param {string} string - string to be escaped
 * @api public
 */
exports.escapeRegExp = escapeRegExp;

function escapeRegExp(string){
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}


/*
 * Check if a record in a database table is unique e.g. check to see if there is more than one user with the same email address
 * returns format callback(err, uniqueFlag) where uniqueFlag is true if the recordToTest is unique and false otherwise
 *
 * @param {object} recordToTest - record being checked for uniqueness.  format {column: columnname, value: recordvalue}
 * @param {object} expectedRecord - (optional) an existing record in the database which can be ignored.  if null, it is assumed there should be no occurences of the record in the table
 * @param {string} table - table in which to search for uniqueness
 * @api public
 */
exports.checkUniqueRecord = checkUniqueRecord;

function checkUniqueRecord(recordToTest, expectedRecord, table, callback){
  // if expectedRecord is not sent then set the other arguments as appropriate
  if(arguments.length === 3){
    callback = table;
    table = expectedRecord;
    expectedRecord = null;
  }
  var uniqueFlag = false;
  var match = 0;
  var columnlist;
  var pool = system.systemVariable.get('pool');
  
  pool.getConnection(function(err, connection){
    if(err){err.message = 'Database connection pool unavailable'; return callback(err);}
    // set up variables for query
    if(expectedRecord === null){
      columnlist = recordToTest.column;
    } else {
      columnlist = recordToTest.column + ',' + expectedRecord.column;
    }
    var query = 'SELECT ' + columnlist + ' FROM ' + table + ' WHERE ' + recordToTest.column + '=' + connection.escape(recordToTest.value);
    connection.query(query, function(err, results){
      if(err){err.message = 'Error checking for unique records'; return callback(err);}
      // check if there are any results other than the expected expectedRecord
      if(expectedRecord !== null){
        _.forEach(results, function(val, key){
          if(expectedRecord.value === val[expectedRecord.column] && expectedRecord.value !== undefined){
            match++;
          }
        }); 
      }

      // check if there are any results left
      if(results.length <= match){uniqueFlag = true;}
      
      return callback(null, uniqueFlag);
    });
  });
}


/*
 * Check if two arrays are equal to each other.
 * For some reason javascript does not return true for ['a'] === ['a'] so this function provides this functionality
 * returns true if both arrays are equal, false otherwise
 * 
 * @param {array} array1 - first array to be used for comparison
 * @param {array} array2 - second array to be used for comparison
 * @param {string} keymatch - set to true if the array keys need to match as well i.e. ['a', 'b'] !== ['b', 'a'], default true
 * @api public
 */
exports.isArrayEqual = isArrayEqual;

function isArrayEqual(array1, array2, keymatch){
  keymatch = keymatch || true;
  
  if (array1 === array2) return true;
  if (array1 == null || array2 == null) return false;
  if (array1.length != array1.length) return false;

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  if(!keymatch){
    // sort both arrays
    array1.sort(compare);
    array2.sort(compare);
  }
  
  function compare(a, b){
    if(typeof a === 'number' && typeof b === 'number'){
      return a - b; 
    }
    if(typeof a === 'string' & typeof b === 'string'){
      if(a > b){return 1;}
      if(a === b){return 0;}
      if(a < b){return -1;}
    }
    if(typeof a !== typeof b){
     return 0; 
    }
    // if not a number or string, don't sort
    return 0;
  }
  
  for (var i = 0; i < array1.length; ++i) {
    if (array1[i] !== array2[i]) return false;
  }
  return true; 
}


/*
 * Convert all string elements of an array or object to lower/upper case
 * 
 * @param {string/array/object} target - array to be converted
 * @param {string} reqCase - case conversion required
 * @param {bool} - keyConvert - if true and target is an object, all keys will be case converted as well
 * @api public
 */
exports.convertCase = convertCase;

function convertCase(target, reqCase, keyConvert){
  var result;
  var type = typeof target;
  if(type === 'object'){
    type = Array.isArray(target) ? 'array' : 'object';
  }
  
  switch(type){
    case 'string':
      result = _convertCaseString(target, reqCase);
      break;
    case 'array':
      result = _convertCaseArray(target, reqCase);
      break;
    case 'object':
      result = _convertCaseObject(target, reqCase, keyConvert);
      break;
    default:
      result = target;
      break;
  }
  
  return result;
  
  function _convertCaseString(string, toCase){
    switch(toCase.toLowerCase()){
      case 'tolowercase':
        return string.toLowerCase();
        break;
      case 'touppercase':
        return string.toUpperCase();
        break;
      default:
        return string;
        break;
    }
  }
  
  function _convertCaseArray(arr, toCase){
    arr.forEach(function(val, key){
      if(typeof val === 'string'){
        switch(toCase.toLowerCase()){
          case 'tolowercase':
            arr[key] = arr[key].toLowerCase();
            break;
          case 'touppercase':
            arr[key] = arr[key].toUpperCase();
            break;
          default:
            break;
        } 
      }
    });
    return arr;
  }
  
  function _convertCaseObject(obj, toCase, keyFlag){
    keyFlag = keyFlag || false;

    var ObjLC = {};  // this object mirrors obj, except that any values of obj that are case converted also will have its keys converted
    _.forEach(obj, function(val, key){

      if(typeof val === 'string'){
        switch(toCase.toLowerCase()){
          case 'tolowercase':
            obj[key] = val.toLowerCase();
            
            // insert lower cased key version into ObjLC
            ObjLC[key.toLowerCase()] = val.toLowerCase();
            break;
          case 'touppercase':
            obj[key] = val.toUpperCase();
            
            // insert upper cased key version into ObjLC
            ObjLC[key.toUpperCase()] = val.toUpperCase();
            break;
          default:
            break;
        }
      } else {
        // insert regular version into ObjLC
        ObjLC[key] = val;
      }
    });

    var result = keyFlag ? ObjLC : obj; 
    return result;
  }
  
}


/*
 * show all objects during console.log
 * ordinarily console.log({a:{b}}) shows up as {a{object}} and does not give the details of {b}
 * this function explodes all objects within other objects
 *
 * @param {object} toScreen - desired output to console.log
 * @api public
 */
exports.inspect = inspect;

function inspect(toScreen){
  return util.inspect(toScreen, false, null);
}


/*
 * Perform a case blind key match of an object
 * i.e. for object {Aa: 'one'}, key match search by 'Aa', 'aa' or 'aA' should return 'one'
 *
 * @param {object} target - target object being searched
 * @param {string} needle - key to be matched
 * @api public
 */
exports.caseBlindKeyMatch = caseBlindKeyMatch;

function caseBlindKeyMatch(target, needle){
  var flag;
  _.forEach(target, function(val, key){
    if(needle.toLowerCase() === key.toLowerCase()){
      flag = key;
    }
  });
  
  var returnValue = flag ? target[flag] : flag; // if match, return the matched, otherwise, return undefined
  
  return returnValue; 
}

/*
 * find the location of the handy directory
 *
 * @api public
 */
exports.findHandyDirectory = findHandyDirectory;

function findHandyDirectory(){
  // get the location of the handy directory
  var currentDirectory = __dirname.split('/');
  currentDirectory.pop();

  // handyDirectory is /path/to/handy
  var handyDirectory = currentDirectory.reduce(function(prev, curr){
    return prev + '/' + curr;
  },'');

  return handyDirectory;
}

/*
 * middleware that allways returns an Error
 * temporary function to test which error handler works
 */
exports.forceError = forceError;

function forceError(req, res, next){
  var err = new Error();
  return next(err);
}