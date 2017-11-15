var gulp = require('gulp-help')(require('gulp'), {hideEmpty: true})
var gutil = require('gulp-util')
var path = require('path')

var globsResolvePath = require('../lib').globsResolvePath
var resolvePath = require('../lib').resolvePath
var bundleCaption = require('../lib').getBundleCaption(__dirname)

var packageConfig = require('./package').config || {}
var options = packageConfig.deploy || {}

// Deployment paths
var sourceBaseDir = options.sourceBaseDir ? resolvePath(options.sourceBaseDir) : undefined
var remotePath = options.remotePath ? resolvePath(options.remotePath) : undefined
var globs = options.globs || undefined

var FTP_SERVER_ARG = 'ftp-server'
var FTP_USER_ARG = 'ftp-user'
var FTP_PASS_ARG = 'ftp-pass'
var FTP_PORT_ARG = 'ftp-port'
var FTP_QUEUES_ARG = 'ftp-queues'

gulp.task('deploy', 'Deploy files to remote server ' + bundleCaption + '\n' +
    gutil.colors.gray('  For using ' + gutil.colors.cyan('deploy') + ' task set shell variables. Example:\n') +
    gutil.colors.blue('  FTP_SERVER="server" FTP_USER="user" FTP_PASS="pass" FTP_PORT="21" gulp deploy\n') +
    gutil.colors.gray('  Otherwise use arguments bellow:'),
    function () {
        var args = require('args-parser')(process.argv)
        var gulp = require('gulp')
        var gutil = require('gulp-util')
        var ftp = require('vinyl-ftp')

        if (!sourceBaseDir || !remotePath) {
            throw new gutil.PluginError('deploy', 'Source or Remote path are not specified properly')
        }

        if (!globs || !(globs instanceof Array) || !globs.length) {
            throw new gutil.PluginError('deploy', 'Sync Globs is not specified properly')
        }

        globs = globsResolvePath(globs, sourceBaseDir)

        var conn = ftp.create({
            host: process.env.FTP_SERVER || args[FTP_SERVER_ARG],
            user: process.env.FTP_USER || args[FTP_USER_ARG],
            password: process.env.FTP_PASS || args[FTP_PASS_ARG],
            port: process.env.FTP_PORT || args[FTP_PORT_ARG] || 21,
            parallel:  process.env.FTP_QUEUES || args[FTP_QUEUES_ARG] || options.parallel,
            log: gutil.log
        });

        return gulp.src(globs, {base: sourceBaseDir, buffer: false})
            .pipe(conn.newer(remotePath)) // Keep new only
            .pipe(conn.dest(remotePath)) // Push new files
    },
    {
        options: function () {
            var options = {}

            options[FTP_SERVER_ARG + '='] = 'FTP server ip address or hostname'
            options[FTP_USER_ARG + '='] = 'FTP server username'
            options[FTP_PASS_ARG + '='] = 'FTP server user password'
            options[FTP_PORT_ARG + '=21 (optional)'] = 'FTP server port. Default: 21'
            options[FTP_QUEUES_ARG + '=5 (optional)'] = 'FTP server port. Default: as in config'

            return options
        }()
    }
)