**Before uploading your files**  
0. Check all "TODO" comments and for each, resolve it/raise an issue about it and then remove it's comment.  
1. ESLint all the JS files/W3Clint all HTML/CSS files.  
2. Update the version number in options.html and manifest to the latest version number.  
3. Remove/comment `console.log`s/`console.dir`s from all JS files. Run Replace function to remove all tab chars at the end of lines - `\t+$`  
4. Minify all the files.   
5. Update the change log in options.html as well as on [github](https://github.com/GaurangTandon/ProKeys/edit/master/change_log.md)  
6. Make sure that the update fixes all the bugs listed for its milestone number.  

**After updating the extension**  
0. Make sure to reply to all people on the [support page](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn/support) as well as on the official email (prokeys.feedback@gmail.com), whose errors have been fixed in this updated version.
1. Update new cards (put them in their respective columns) on the [main project](https://github.com/GaurangTandon/ProKeys/projects/1) for the new issues that were filed while the development. This helps have laser sharp focus for the next update. (Also delete the column that was being used for this update.)

**Please follow the following conventions:**

1. All class names in HTML must be in small case. Multiple words should be separated by underscore.
2. Snippet parts should be referred to as "name" and "body" respectively.
3. All variables names related to a HTML Node should EITHER have $ at the start of their name OR contain the word "node" (not elm) in their name.
