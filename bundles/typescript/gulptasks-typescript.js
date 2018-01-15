var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var path = require('path')
var notifier = require('node-notifier')
var gutil = require('gulp-util')

var bundleCaption = require('../lib').getBundleCaption(__dirname)
var packageConfig = require('./package').config || {}
var globsResolvePath = require('../lib').globsResolvePath
var sourceMapRootResolve = require('../lib').sourceMapRootResolve

var tsProject

gulp.task('typescript-compile', function () {
    var ts = require('gulp-typescript'),
        cache = require('gulp-cached'),
        sourcemaps = require('gulp-sourcemaps'),
        plumber = require('gulp-plumber')

    tsProject = tsProject || ts.createProject(packageConfig.tsConfigPath)

    var outBaseDir = packageConfig.outPath

    return tsProject.src()
        // .pipe(cache(outBaseDir + '-typescript')) // Filter for same files
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .on('error', function (error) {
            try {
                notifier.notify({title: 'Typescript compilation error', message: error.message})
            }
            catch (e) {}

            gutil.log(gutil.colors.red('Typescript compilation error: ' + error.message))
            this.emit('end')
        })
        .js
            .pipe(sourcemaps.write('.', {
                sourceRoot: sourceMapRootResolve.bind(this, packageConfig.sourceMapSourceRoot, outBaseDir)
            }))
            .pipe(gulp.dest(outBaseDir))
})

gulp.task('typescript-compile-watch', 'Run Typescript watching ' + bundleCaption, ['typescript-compile'], function () {
    var ts = require('gulp-typescript')

    var tsProject = ts.createProject(packageConfig.tsConfigPath)

    var sourceBaseDir = path.resolve(path.dirname(packageConfig.tsConfigPath))

    var globs = globsResolvePath(tsProject.config.include, sourceBaseDir)

    var excludeGlobs = []

    if (tsProject.config.exclude) {
        tsProject.config.exclude.forEach(function (path) {
            excludeGlobs.push('!' + path)
        })

        excludeGlobs = globsResolvePath(excludeGlobs, sourceBaseDir)
    }

    globs = globs.concat(excludeGlobs)

    gulp.watch(globs, ['typescript-compile'])
})