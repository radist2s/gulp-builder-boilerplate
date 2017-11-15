var npm = require('npm')

var args = process.argv.slice(2)

var fs = require('fs')
var path = require('path')

args.forEach(function (arg) {
    var packageDir = path.join(__dirname, arg),
        packages = []

    if (packageDir.substr(-1) === '*') {
        var bundlesDir = path.dirname(packageDir)

        fs.readdirSync(bundlesDir).filter(function (path) {
            var packageDir = path.join(bundlesDir, path)

            if (fs.statSync(packageDir).isDirectory()) {
                packages.push(packageDir)
            }
        })
    }
    else {
        if (fs.lstatSync(packageDir).isDirectory()) {
            packages.push(packageDir)
        }
    }

    packages.forEach(function (packageDir) {
        installPackage(packageDir)
    })
})

function installPackage(directory) {
    try {
        var package = require(path.join(directory, 'package'))

        var dependencies = package.dependencies,
            config = package.config || {}
    }
    catch (e) {
        console.error(e.message)

        return
    }

    if (typeof dependencies !== 'object') {
        return
    }

    var packages = []

    Object.keys(dependencies).forEach(function (pkg) {
        var version = dependencies[pkg]

        packages.push(pkg + '@' + version)
    })

    if (packages.length) {
        npmInstall(packages, config, directory)
    }
}

function npmInstall(packages, config, bundleDirectory) {
    var installationDir = config.localInstallation ? bundleDirectory : path.dirname(bundleDirectory)

    npm.load(
        {
            save: true,
            loaded: false
        },
        function (err) {
            err && console.error(err)

            npm.commands.install(installationDir, packages, function (error, data) {
                error && console.error(error)
            })

            npm.on('log', function (message) {
                console.log(message)
            })
        }
    )
}