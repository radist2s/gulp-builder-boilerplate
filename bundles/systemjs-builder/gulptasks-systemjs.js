var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var gutil = require('gulp-util')
var path = require('path')
var notifier = require('node-notifier')

var bundleCaption = require('../lib').getBundleCaption(__dirname)
var packageConfig = require('./package').config || {}
var resolvePath = require('../lib').resolvePath
var globsResolvePath = require('../lib').globsResolvePath

var runSequence = require('run-sequence')

var systemBuilderInstance

var systemBuilderOptions = {
    minify: false,
    uglify: false,
    mangle: false, // Allow the minifier to shorten non-public variable names
    sourceMaps: true,
    sourceMapContents: true,
    lowResSourceMaps: false,
    globalDefs: {
        DEBUG: false
    },
    globalName: 'App'
}

function systemBuilder() {
    var Builder = require('systemjs-builder')

    systemBuilderInstance = systemBuilderInstance
        || new Builder(packageConfig.systemBaseURL, packageConfig.systemConfigPath)

    systemBuilderInstance.reset()

    return systemBuilderInstance
}

gulp.task('systemjs-builder', 'Build SystemJs modules ' + bundleCaption, function (done) {
    systemBuilder()
        .bundle(packageConfig.moduleFile, packageConfig.outFile, systemBuilderOptions)
        .then(function () {
            gutil.log(gutil.colors.green('Built successful'))
            done()
        })
        .catch(function (err) {
            gutil.log(gutil.colors.red('Build error'))
            gutil.log(gutil.colors.red(err))
        })
})

gulp.task('systemjs-builder-watch', 'Watch for globs and run SystemJs builder ' + bundleCaption, ['systemjs-builder'], function () {
    var globs = globsResolvePath(packageConfig.watchGlobs, process.cwd())

    gulp.watch(globs, ['systemjs-builder'])
})

gulp.task('systemjs-builder-ts', function (complete) {
    return runSequence(
        'typescript-compile',
        'systemjs-builder',
        complete
    )
})