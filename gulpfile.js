var gulp = require('gulp'),
  babel = require('gulp-babel')
  gUtil = require('gulp-util'),
  source = require('vinyl-source-stream'),
  rename = require('gulp-rename'),
  browserify = require('browserify'),
  babelify = require('babelify'),
  watchify = require('watchify'),
  path = require('path'),
  plumber = require('gulp-plumber'),
  fs = require('fs-extra'),
  mongodbData = require('gulp-mongodb-data')

function printErrorStack(err) {
  if (err)
    console.log(err.stack || err);
};

gulp.task('watch', ['compile', 'compile-routes'], () => {
  var watcher1 = gulp.watch('src/**/*.js', ['compile'])
  watcher1.on('change', (event) => {
    console.log("\n****** Watcher Message ******\nFile " + event.path + ' was ' + event.type + ', compiling...')
  })

  var watcher2 = gulp.watch('routes-src/**/*.js', ['compile-routes'])
  watcher2.on('change', (event) => {
    console.log("\n****** Watcher Message ******\nFile " + event.path + ' was ' + event.type + ', compiling...')
  })
})

gulp.task('compile', () => {
  return gulp.src('src/**/*.js')
    .pipe(plumber({errorHandler: (err) =>
      {console.log("\n****** Plumber Message ******\nUnhandled error:\n", err.stack)}}
    ))
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('lib/'))
})

gulp.task('compile-routes', () => {
  return gulp.src('routes-src/**/*.js')
    .pipe(plumber({errorHandler: (err) => {
      console.log("\n****** Plumber Message ******\nUnhandled error:\n", err.stack)
    }}))
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('routes/'))
})

gulp.task('compile-parser', () => {
  return gulp.src('parser-src/**/*.js')
    .pipe(plumber({errorHandler: (err) => {
      console.log("\n****** Plumber Message ******\nUnhandled error:\n", err.stack)
    }}))
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(gulp.dest('parser/'))
})

gulp.task ("compile-peg", () => {
  return gulp.src('parser-src/**/*.pegjs')
    //.pipe(peg().on("error", console.log))
    .pipe(gulp.dest('parser/'))
})

gulp.task('default-config', () => {
  gulp.src(['./config/default.js'])
    .pipe(rename('config.js'))
    .pipe(gulp.dest('./config/'))
})

gulp.task('install', () => {
  gulp.src(['./node_modules/pegjs/lib/**'])
    .pipe(gulp.dest('./public/vendor/pegjs/'))
})

gulp.task('init', () => {
  gulp.src('./util/init-data.js')
    .pipe(mongodbData({mongoUrl: 'mongodb://mongo/conalog', collectionName: 'user'}))
})

gulp.task('go', ['compile', 'compile-routes', 'compile-parser','compile-peg'], () => {

})
