const gulp = require("gulp"),
  csso = require("gulp-csso"),
  htmlmin = require("gulp-htmlmin"),
  babel = require("gulp-babel"),
  jsminify = require("gulp-uglify"),
  jsonminify = require("gulp-jsonminify"),
  SRC = ".",
  DEST = "./dest";

gulp.task("styles", () =>
  gulp
    .src(`${SRC}/css/*.css`)
    .pipe(csso())
    .pipe(gulp.dest(`${DEST}/css`))
);

gulp.task("scripts", () =>
  gulp
    .src(`${SRC}/js/*.js`)
    .pipe(
      babel({
        presets: ["@babel/preset-env"]
      })
    )
    .pipe(jsminify())
    .pipe(gulp.dest(`${DEST}/js`))
);

gulp.task("html", () =>
  gulp
    .src(`${SRC}/html/*.html`)
    .pipe(
      htmlmin({
        collapseWhiteSpace: true,
        removeComments: true
      })
    )
    .pipe(gulp.dest(`${DEST}/html`))
);

gulp.task("manifest", () =>
  gulp
    .src(`${SRC}/manifest.json`)
    .pipe(jsonminify())
    .pipe(gulp.dest(DEST))
);

gulp.task("images", () =>
  gulp.src(`${SRC}/imgs/*.*`).pipe(gulp.dest(`${DEST}/imgs`))
);

gulp.task(
  "default",
  gulp.series("styles", "scripts", "html", "manifest", "images")
);
