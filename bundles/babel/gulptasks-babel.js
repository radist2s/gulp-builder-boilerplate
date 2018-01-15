var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var gutil = require('gulp-util')
var path = require('path')
var notifier = require('node-notifier')

var bundleCaption = require('../lib').getBundleCaption(__dirname)
var packageConfig = require('./package').config || {}
var babelOptions = packageConfig.babel || {}
var resolvePath = require('../lib').resolvePath
var globsResolvePath = require('../lib').globsResolvePath
var sourceMapRootResolve = require('../lib').sourceMapRootResolve
var outBaseDir = packageConfig.outBaseDir ? resolvePath(packageConfig.outBaseDir) : undefined

function babelConfigResolve() {
    if (babelConfigResolve.resolved) {
        return
    }

    if (!packageConfig.presetsResolve && babelOptions.presets) {
        return
    }

    babelOptions.presets = babelOptions.presets.map(function (preset) {
        var args

        if (preset instanceof Array) {
            args = preset[1]
            preset = preset[0]
        }

        preset = require.resolve('babel-preset-' + preset)

        return args ? [preset, args] : preset
    })

    babelConfigResolve.resolved = true
}

gulp.task('babel-compile', 'Transform source files with Babel pipes and exit ' + bundleCaption, function () {
    babelConfigResolve()

    var babel = require('gulp-babel'),
        sourcemaps = require('gulp-sourcemaps'),
        cache = require('gulp-cached')

    var globs = globsResolvePath(packageConfig.compileGlobs, process.cwd())

    return gulp.src(globs)
        .pipe(cache(outBaseDir + '-babel')) // Filter for same files

        .pipe(sourcemaps.init())

        .pipe(babel(babelOptions))

        .on('error', function (error) {
            try {
                notifier.notify({title: 'Babel compilation error', message: error.message})
            }
            catch (e) {}

            gutil.log(gutil.colors.red('Babel compilation error: ' + error.message))
            this.emit('end')
        })

        .pipe(sourcemaps.write('.', {
            sourceRoot: sourceMapRootResolve.bind(this, packageConfig.sourceMapSourceRoot, outBaseDir)
        }))

        .pipe(gulp.dest(outBaseDir))
})

gulp.task('babel-compile-watch', 'Run Babel watching' + bundleCaption, ['babel-compile'], function () {
    babelConfigResolve()

    var globs = globsResolvePath(packageConfig.compileGlobs, process.cwd())

    gulp.watch(globs, ['babel-compile'])
})