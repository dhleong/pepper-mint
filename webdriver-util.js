
var webdriver = require('selenium-webdriver')
  , WebElementCondition = webdriver.WebElementCondition;

/**
 *
 */
module.exports.elementAttrMatches = function(locator, attrName, fn, self) {
  return new WebElementCondition('until element[' + attrName + '] matches',
      function(driver) {
          return driver.findElement(locator).then(function(el) {
              return el && el.getAttribute(attrName).then(v => fn(v) ? el : null);
          })
      });
}
