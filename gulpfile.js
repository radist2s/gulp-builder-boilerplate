var path = require('path')
var gutil = require('gulp-util')

require('./bundles/image') // Use package to configure or override vars here

require('./bundles/less') // Use package to configure or override vars here

require('./bundles/font') // Use package to configure or override vars here

require('./bundles/rjs') // Use package to configure. No overriding supports.

require('./bundles/freezer')({ // Use package to configure or override vars here
    // CSS Freezer
    // cssFiles: '../../assets/dist/css/*.css',

    // JS Freezer
    // jsFiles: '../../assets/dist/js/*.js'
})

require('./bundles/deploy') // Use package to configure. No overriding supports.

require('./bundles/babel') // Use package to configure. No overriding supports.

require('./bundles/typescript')

require('./bundles/systemjs-builder/gulptasks-systemjs')

/** Final common tasks **/

const gulp = require('gulp-help')(require('gulp'), {
        hideEmpty: true,
        afterPrintCallback: function () {
            console.log(gutil.colors.yellow(
                'Every tasks belongs to their own bundle. To run any task make sure you installed bundle.\n' +
                'For example: `svg-optim` task belongs to bundle `image`. You have to install bundle before:'
            ))
            console.log(gutil.colors.blue('npm run install-image'))
        }
    }
)

var BUILD_SPRITES_ARG = 'build-sprites'

gulp.task('default', 'Compile LESS and run LESS watch',
    function (callback) {
        var runSequence = require('run-sequence')
        var args = require('args-parser')(process.argv)

        var tasks = [
            'less-livereload',
            'less-watch',
            callback
        ]

        // Check for no build sprites arg
        switch (args[BUILD_SPRITES_ARG]) {
            case 'no':
            case String(false):
            case String(0):
                break
            default:
                tasks.unshift('build-sprites')
                break
        }

        runSequence.apply(runSequence, tasks)
    },
    {
        options: function () {
            var options = {}

            options[BUILD_SPRITES_ARG + '=[yes|no]'] = 'Build sprites before first LESS compilation. Default: yes'

            return options
        }()
    }
)