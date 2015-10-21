[![logo of prokeys](http://s27.postimg.org/7z02emgg3/main_logo.png)](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn)

**Latest version**: 2.6.0.1
**Status**: active, stable build (last update 18/Oct/15)

ProKeys is a completely free, [Google Chrome](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn) and [Opera](https://addons.opera.com/en/extensions/details/prokeys/?display=en) extension that lets you be productive in online text-related work with its number of features like:

[More info on all these in Help section inside the app]  
1. **Snippets** - define custom abbreviations, and retrieve the text associated with them simply by pressing the hotkey (default: Shift+Space). Example: "brb" can expand to "Be right back!"  
2. **Placeholders** - are fields in the snippet body that can be given dynamic values on using the snippet.  
3. **Mathomania** - do math without leaving your text editor, and without calculators. Example: "[[ 15% * 600 =]]" gives "90" and "[[ (5+6) * 15^2 =]]" gives "2475"  
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

## [Change Log](https://github.com/GaurangTandon/ProKeys/blob/master/change_log.md)
