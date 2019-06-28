# Contributing guide

## Development pattern

1. For every new feature of the give milestone, branch from that milestone's branch.
2. When done, merge that feature branch into the milestone branch.
3. When milestone is complete, merge it into master.

## Making a PR for a feature/bug

These PRs are more than welcome! However, it is recommended you open an issue before opening a PR so that others know you are working on that task, and you can get valuable insights from everyone about it.

The linting setup prevents files with errors being committed. Adding `eslint-disable` comments or changing `.eslintrc.json` is discouraged (please raise an issue if you want to do so.) 

If you're using VS Code refer [here](https://stackoverflow.com/a/56554313) to setup an automatic build setup. Other users may manually run `npm run build` in there terminal to build the files into the `dist/` folder.

## Uploading to the webstore

## **Before uploading**  

1. Check all "TODO" comments and for each, resolve it/raise an issue about it and then remove it.  
2. Remove/comment `console.log`s/`console.dir`s from all JS files. <s>Run Replace function to remove all tab chars at the end of lines - `\t+$` Can cause problems like [this one](https://github.com/GaurangTandon/ProKeys/commit/3ece14b5aa09c08cd283a1cc1d736ceb178fa3f3)</s>  
3. Update the change log in options.html.
4. Make sure that the update fixes all the bugs listed for its milestone number.  
5. Check for an [update](http://quilljs.com/docs/download/) to quill version, and replace the `min.js` and `snow.css` files in our codebase. Verify that this does not break any existing RTE logic.
6. Run UI tests (Jest+Puppeteer).
7. Update MODE to production in webpack config js before final build, and do build once.

## **After updating the extension**

1. Make sure to reply to all people on the [support page](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn/support) as well as on the official email (prokeys.feedback@gmail.com), whose errors have been fixed in this updated version.  
2. Update new cards (put them in their respective columns) on the [main project](https://github.com/GaurangTandon/ProKeys/projects/1) for the new issues that were filed while the development. This helps have laser sharp focus for the next update. (Also delete the column that was being used for this update.)  
3. Upload the compressed zipped file under [Releases](https://github.com/GaurangTandon/ProKeys/releases) and <s>the uncompressed files to master branch of codebase.</s> useless if I keep committing code frequently enough  
4. Update the [known bugs list](https://docs.google.com/document/d/1_MHKm1jtpJCWgksfbUdufExRFlF81S-IuTz1Czu7gOI/edit)

**Please follow the following conventions:**

1. All class names in HTML must be in small case. Multiple words should be separated by underscore.
2. Snippet parts should be referred to as "name" and "body" respectively.
3. All variables names related to a HTML Node should EITHER have $ at the start of their name OR contain the word "node" (not elm) in their name.
