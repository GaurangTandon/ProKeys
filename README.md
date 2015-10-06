[![logo of prokeys](http://s27.postimg.org/7z02emgg3/main_logo.png)](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn)

**Latest version**: 2.5.4
**Status**: active, stable build

ProKeys is a completely free, [Google Chrome](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn) and [Opera](https://addons.opera.com/en/extensions/details/prokeys/?display=en) extension that lets you be productive in online text-related work with its number of features like:

[More info on all these in Help section inside the app]  
1. **Snippets** - define custom abbreviations, and retrieve the text associated with them simply by pressing the hotkey (default: Shift+Space). Example: "brb" can expand to "Be right back!"  
2. **Placeholders** - are fields in the snippet body that can be given dynamic values on using the snippet.  
3. **Mathomania** - do math without leaving your text editor, and without calculators. Example: "[[ 15% * 600 =]]" gives "90" and "[[ (5+6) * 15^2 =]]" gives "2475". 
4. **Auto-Insert** - Quotes ('"') and braces ('(', '[', '{') are auto-completed, and you can specify your custom insert-it-for-me also (like, inserting a '>' on typing of a '<') in the settings.  
5. **Date/Time Macros** - embed short symbols inside the parentheses of '[[%d()]]' inside a snippet body and it will auto replace the symbol with the current date and time related value. A sample snippet as well as a guide has been provided (in Help section inside the app)   
6. **Date/Time Arithmetic** - use the `+` or `-` sign to move forward or backward in time in date/time macros. Supports both relative as well as independent evaluation.  
7. **Variables** - built-in variables holding dynamic values for "date", "time" and (browser) "version"  
8. **Tab Key**- The tab key can be made to insert 4 spaces, instead of it's default function, thus speeding up work.  

## Libraries/Code sources
No libraries what so ever! I only utilized vanilla JS for super performce and less app size. Eric Meyer's CSS reset stylesheet - public domain - has been used with modifications.

##Technical details
Are shared on [here](http://electricweb.org/chrome-extension-tutorial-snippets) in a long, three post series. In brief: this extension uses content scripts which are injected into every page and (what follows is for the snippet functionality only) every time the user presses the hotkey, a check is made for the preceding text, which if matches the name of any of the snippets, is substituted with the snippet body. A subsequent test for placeholders is made as well.

## Contribute

First of all, thanks for contribution! Every small bit of it counts! You can:

1. [Create a new issue](https://github.com/GaurangTandon/ProKeys/issues/new) for bugs, feature requests, and enhancements.
2. [Write a review](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn/reviews) ([anonymous feedback](https://docs.google.com/forms/d/1DcwQB5vnNCH0pP_Y-wVvOF6gsI0gaXGPPngctb4tCdA/viewform?usp=send_form)), or [get support](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn/support) with some techincal glitches.
3. Fork the repo, make changes, and submit a pull request, describing the changes made.
4. Help me translate ProKeys to your native language.
5. Share the word about ProKeys with people!
6. [Flattr ProKeys](https://flattr.com/thing/3a21a326ed09014a80254c2938cd5bee) - buy me a ~~beer~~ coffee!

**Contact me** - prokeys.feedback@gmail.com - to discuss anything related to the above if you want to.

## [Known Issues](https://docs.google.com/document/d/1_MHKm1jtpJCWgksfbUdufExRFlF81S-IuTz1Czu7gOI/edit?usp=sharing)

## Next feature to come:

1. Snippets/settings access in context menus
2. Clipboard access in snippet body
3. Get started with gaurangtandon.github.io/prokeys. Use http://dns.js.org/ for hosting. Use: https://github.com/Khan/tota11y
4. Update Opera with latest release
5. Create ProKeys for Firefox, IE, Edge, Safari

## Change Log

**2.6.2** - upcoming
- settings access in context menu // (show modal in settings page on context menu click)

**2.6.1** - upcoming
- remove case-sensitivity for snippet names!
-  highlight snippet on save, edit to indicate save
-  fix for certain keycodes not corresponding with their actual key name (in hotkey feature)
-  support for http://ckeditor.com/demo // (if possible)

**2.6.0** - upcoming
- shorter image names
- minified images - saving nearly 10 KB :)
- new Google Plus logo in About page
- fix for [excessive CPU usage issue](https://github.com/GaurangTandon/ProKeys/issues/3)
- disabled ProKeys for input boxes using ReactJS (they possess `reactid ` in `dataset`)
- refactored detector.js code and others with ESLint
- fix for bug when pressing hotkey while having some text selected
- fix for GitHub, JSFiddle, and other sites which use their own editor (CodeMirror, ace, etc. which interferes with ProKeys)

**2.5.4** - Current -  14/08/2015
- changes in links to the tryit editor in Help section
- fix super ugly bug of "Search" button in popup

**2.5.3** - 06/07/2015
- changes to symbol list order (small to large time duration)
- super bug fix for mathomania!
- quick bug fixes
- refactored popup.js code with bling.js
- help page is now the default page in options.html

**2.5.2** - 05/07/2015
- support for date and time arithmetic, relative as well as independent
- organized symbols, variables into a clean table
- revamped sample snippets shown on first intall
- introduced TryIt editor in Help page


**2.5.1** - 04/07/2015
- fixed a strange issue where on empty snippet was initially shown on install

**2.5.0** - 04/07/2015
- added case-sensitive notice to snippet name
- Nice notifications for install and update
- injecting script automatically on install on most webpages
- sync storage support
- tab key space support removed for input elements
- added "MM" symbol for numeric month in date-time macros
- added “Variables” concept
- improved restore functionality with descriptive error messages
- severe code refactoring to show off on GitHub!

**2.4.6** - 03/05/2015
- removed coloring of counterChecker’s display message (“You have x chars left”)
- fixed bug of textarea height
- removed minimum char limits on snip body and name. Increased body max limit to 2000 characters.
- some code refactoring as well
- made “date-time-macros sample” snippet more helpful
- updated Opera 1.2.0 release

**2.4.5.1** - 15/04/2015
- added support for Evernote beta
- fixed bytes available link in popup html
- removed support for password input
- updated Opera 1.1.0 release

**2.4.5** - 13/04/2015  
- added support for all <input> elements except email/number (because they don’t support caret manipulation)

**2.4.4.1** - 05/04/2015
- removed console.log’s, which were left erroneously, and were used for development purpose
- css changes to popup

**2.4.4** - 04/04/2015
- Facebook Chat, Atlassian (Confluence), Evernote, Mailchimp, Basecamp support added

**2.4.3** - 30/03/2015
- made popup.html and options.html responsive for 200x zoom and 67% zoom both!
- fixed the issue of “none currently” showing in character-counterpart pairs
- fixed site blocker errors
- fixed issue in backup/restore functionality
- added support for SalesForce, Slack

**2.4.2** - 12/03/2015
- fixed silly bugs
- fixed site blocker not working for gmail
- compressed manifest.json
- Opera 1.0.0 release

**2.4.1** - 11/03/2015
- Added option to change hotkey for snippet substitution
- added flattr button

**2.4.0** - 05/03/2015
- date and time macros are here!
- added one sample snippet for date-time macros
- added You have used 1860 bytes out of 102,400 bytes; 11 snippets currently notice

**2.3.0** - 09/11/2014
- Support rich text format (bold, italic, underline)
- options page improvement
- changed snippet viewing to down arrow in popup window
- added helpful sample snippets

**2.2.0** - 01/11/2014
- Fixed the white space collapse problem, by changing the text nodes to span element nodes and completely revamping the functioning of popup.js due to this
- Reduced the line-height of the snippet body in popup window

**2.1.0** - 01/10/2014
- mathomania fixes
- validation format changed

**2.0.0** - 11/09/2014
- Mathomania (type and do math)
- Sync storage
- Options page responsive (for smaller screens)
- print a list of snippets/settings
- backup and restore of settings/snippets
- accidental shift+space produces space and not snippet or error
- added window.onerror

  changes preceding this version are just too minor (and bad)
  to be shown; 

**1.0.0** - 25/June/2014
- ProKeys released
