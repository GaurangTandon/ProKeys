## [ProKeys](https://chrome.google.com/webstore/detail/prokeys/ekfnbpgmmeahnnlpjibofkobpdkifapn)
**Latest version**: 2.5.1

A free Google Chrome extension that lets you be productive in online text-related work with its number of features like:

[More info on all these in Help section inside the app]
1. **Snippets**-  expand abbreviations
Define custom abbreviations, and retrieve the text associated with them simply by pressing the hotkey (default: Shift+Space). Example: "brb" can expand to "Be right back!"
2. **Placeholders** - are fields in the snippet body that can be given dynamic values on using the snippet.
**Mathomania** - do math without leaving your text editor, and without calculators. Example: "[[ 15% * 600 =]]" gives "90" and "[[ (5+6) * 15^2 =]]" gives "2475".
3. **Auto-Insert** - Quotes ('"') and braces ('(', '[', '{') are auto-completed, and you can specify your custom insert-it-for-me also (like, inserting a '>' on typing of a '<') in the settings. Type twice the rate!
4. **Date/Time Macros** - embed short symbols inside the parentheses of '[[%d()]]' inside a snippet body and it will auto replace the symbol with the current date and time related value. A sample snippet as well as a guide has been provided (in Help section inside the app)
5. **Variables** - Type square brackets, `[[`, and inside them, type the variable name, which is built-in. It will automatically be replaced with their current dynamic value.
6. **Tab Key**- The tab key can be made to insert 4 spaces, instead of it's default function, thus speeding up work.

**Technical details**
All such details are shared on [here](http://electricweb.org/chrome-extension-tutorial-snippets) in a long, three post series. In brief: this extension uses content scripts which are injected into every page and (what follows is for the snippet functionality only) every time the user presses the hotkey, a check is made for the preceding text, which if matches the name of any of the snippets, is substituted with the snippet body. A subsequent test for placeholders is made as well.
