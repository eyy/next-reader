var express = require('express'),
    http = require('http'),
    path = require('path'),
    stylus = require('stylus');

var app = express();

// all environments
app.set('port', process.env.PORT || 80);

// dust
app.engine('dust', require('consolidate').dust);
app.set('view engine', 'dust');
app.set('views', __dirname + '/views');

// stylus
app.use(stylus.middleware({
    src: path.join(__dirname + '/public'),
    compile: function compile(str, path) {
        return stylus(str)
            .set('filename', path)
            .set('compress', true);
    }
}));

app.use(express.favicon());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('what'));
app.use(express.cookieSession({cookie: { maxAge: 60 * 1000 * 60 * 24 }}));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

require('mongoose').connect('mongodb://localhost/next-reader');
require('formage-admin').init(app, express, require('./models'), {
    title: 'Nexter'
});
require('./routes')(app);
app.use('/api', require('resors').middleware());

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
