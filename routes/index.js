
/*
 * GET home page.
 */

module.exports = function(app){
  require('./main')(app);  // generic routes e.g. home, about, etc; GET only
  require('./forms')(app); // form action routes; POST only
};

