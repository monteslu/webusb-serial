'use strict';

var util = require('util');
var stream = require('stream');

var DEFAULT_FILTERS = [
  { 'vendorId': 0x2341, 'productId': 0x8036 }, // Arduino Leonardo
  { 'vendorId': 0x2341, 'productId': 0x8037 }, // Arduino Micro
  { 'vendorId': 0x239a, 'productId': 0x8011 } // Adafruit Circuit Playground
];


function WebUSBSerialPort(options) {
  var self = this;

  options = options || {};
  self.filters = options.filters || DEFAULT_FILTERS;

  function handleDevice(device) {
    self.device = device;

    var readLoop = function(){
      self.device.transferIn(5, 64).then(function(result){
        self.emit('data', new Buffer(result.data.buffer));
        readLoop();
      }, function(error){
        self.emit('emit', error);
      });
    };

    self.device.open()
      .then(function(){
        return self.device.configuration;
      })
      .then(function(config){
        if (config.configurationValue == 1) {
          return {};
        } else {
          throw new Error("Need to setConfiguration(1).");
        }
      })
      .catch(function(error){
        return self.device.setConfiguration(1);
      })
      .then(function(){
        return self.device.claimInterface(2);
      })
      .then(function(){
        return  self.device.controlTransferOut({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0x22,
          'value': 0x01,
          'index': 0x02});
      })
      .then(function() {
        self.emit('open');
        readLoop();
      });
  }

  if(options.device) {
    return handleDevice(options.device);
  }
  else{
    return navigator.usb.requestDevice({filters: self.filters })
    .then(handleDevice)
    .catch(function(err){
      self.emit('error', err);
    });
  }
  
}

util.inherits(WebUSBSerialPort, stream.Stream);


WebUSBSerialPort.prototype.open = function (callback) {
  this.emit('open');
  if (callback) {
    callback();
  }

};



WebUSBSerialPort.prototype.write = function (data, callback) {
  this.device.transferOut(4, data)
  .then(function(){
    if(callback){
      callback(null);
    }
  })
  .catch(function(error){
    if(callback){
      callback(error);
    }
  });

};



WebUSBSerialPort.prototype.close = function (callback) {
  var self = this;
  self.device.controlTransferOut({
              'requestType': 'class',
              'recipient': 'interface',
              'request': 0x22,
              'value': 0x00,
              'index': 0x02})
    .then(function(){
      self.device.close();
      if(callback){
        callback();
      }
    });

};

WebUSBSerialPort.prototype.flush = function (callback) {
  if(callback){
    callback();
  }
};

WebUSBSerialPort.prototype.drain = function (callback) {
  if(callback){
    callback();
  }
};

WebUSBSerialPort.DEFAULT_FILTERS = DEFAULT_FILTERS;

module.exports = WebUSBSerialPort;
