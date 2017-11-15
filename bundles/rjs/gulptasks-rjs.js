var gulp = require('gulp')
var fs = require('fs')
var path = require('path')
var gutil = require('gulp-util')

var resolvePath = require('../lib').resolvePath
var bundleCaption = require('../lib').getBundleCaption(__dirname)

var packageConfig = require('./package').config || {}
var options = packageConfig.rjs || {}

var jsBuildConfigFile = options.configFile ? resolvePath(options.configFile) : undefined

gulp.task('rjs', 'Run RJS - require.js optimizer ' + bundleCaption, function (gulpDone) {
    var requirejs = require('requirejs')

    if (!jsBuildConfigFile) {
        throw new gutil.PluginError('rjs', 'Build config File not specified')
    }

    try {
        var buildConfig = eval(
            String(fs.readFileSync(jsBuildConfigFile))
        )
    }
    catch (error) {
        gutil.log(gutil.colors.red('Build config reading error.', jsBuildConfigFile))

        throw new gutil.PluginError('rjs', error.message, {showStack: true})
    }

    if (!(buildConfig instanceof Object)) {
        throw new Error('Build config is not object. ' + jsBuildConfigFile)
    }

    buildConfig.baseUrl = path.resolve(path.dirname(jsBuildConfigFile), buildConfig.baseUrl || '.')

    if (buildConfig.mainConfigFile) {
        buildConfig.mainConfigFile = path.resolve(buildConfig.baseUrl, buildConfig.mainConfigFile)
    }

    if (buildConfig.out) {
        buildConfig.out = path.resolve(buildConfig.baseUrl, buildConfig.out)
    }
    else {
        buildConfig.out = path.join(buildConfig.baseUrl, path.basename(buildConfig.name, '.js'))
    }

    if (options.stdout) {
        buildConfig.out = 'stdout'
    }

    requirejs.optimize(buildConfig, function () {
        gulpDone()
    }, gulpDone)
})