var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var gutil = require('gulp-util')
var notifier = require('node-notifier')
var path = require('path')
var liveReloadModule

var args = require('args-parser')(process.argv)

var packageConfig = require('./package').config || {}
var lessConfig = packageConfig.less || {}

var globsResolvePath = require('../lib').globsResolvePath
var bundleCaption = require('../lib').getBundleCaption(__dirname)

var cssOutDir = lessConfig.cssOutDir

function liveReload() {
    if (!liveReloadModule) {
        liveReloadModule = require('gulp-livereload')
        liveReloadModule.listen()
    }

    return liveReloadModule
}

gulp.task('less', 'Build LESS files with PostCSS pipes and exit ' + bundleCaption, function () {
    return createLessStream()
})

gulp.task('less-livereload', function () {
    var pathWildeCard = require('../lib').pathWildeCard
    var cssOutDirWildeCard = pathWildeCard(cssOutDir, '**.css')

    var filter = require('gulp-filter')

    return createLessStream()
        .pipe(filter(cssOutDirWildeCard)) // Filter .map & .css filer to pass *.css only
        .pipe(liveReload()())
})

const COMPILE_FIRST_ARG = 'compile-first'

gulp.task('less-watch', 'Run LESS watch with LiveReload ' + bundleCaption,
    args[COMPILE_FIRST_ARG] ? ['less'] : [],
    function () {
        gulp.watch(lessConfig.watchGlobs, ['less-livereload'])
    },
    {
        options: function () {
            var options = {}

            options[COMPILE_FIRST_ARG] = 'Compile LESS first then start watch'

            return options
        }()
    }
)

function createLessStream() {
    var cache = require('gulp-cached')

    var less = require('gulp-less')

    var postcss = require('gulp-postcss'),
        postcssMath = require('postcss-math'),
        sourcemaps = require('gulp-sourcemaps'),
        autoprefixer = require('autoprefixer'),
        gulpCleanCSS = require('gulp-clean-css')

    var postCssPipe = postcss([
        postcssMath,
        autoprefixer({browsers: ['last 2 version', '> 1%', 'ie >= 8', 'Firefox > 15', 'iOS >= 5', 'Android >= 2.3']})
    ])

    var globs = globsResolvePath(lessConfig.compileGlobs, process.cwd())

    return gulp
        .src(globs)

        .pipe(sourcemaps.init())

        // Less compilation
        .pipe(less({ieCompat: true}))
        .on('error', function (error) {
            try {
                notifier.notify({title: 'Less compilation error', message: error.message})
            }
            catch (e) {}

            gutil.log(gutil.colors.red('Less compilation error: ' + error.message))
            this.emit('end')
        })

        // Filter for same css file
        .pipe(cache(cssOutDir + '-less'))

        // Clean css
        .pipe(gulpCleanCSS({
            compatibility: 'ie8',
            level: {1: {specialComments: true}}
        }))

        // Postcss
        .pipe(postCssPipe.on('error', function (error) {
            try {
                notifier.notify({title: 'Postcss error', message: error.message.replace(/"+/, "'")})
            }
            catch (e) {}

            gutil.log(gutil.colors.red('Postcss error: ' + error.message))
            this.emit('end')
        }))

        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(cssOutDir))
}