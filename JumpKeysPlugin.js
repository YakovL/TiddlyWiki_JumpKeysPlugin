/***
|Description|Adds an interface and hotkeys for jumping between tiddlers and more|
|Source     |https://github.com/YakovL/TiddlyWiki_JumpKeysPlugin/blob/master/JumpKeysPlugin.js|
|Author     |Yakov Litvin|
|Version    |1.2.5|
|License    |[[MIT|https://github.com/YakovL/TiddlyWiki_YL_ExtensionsCollection/blob/master/Common%20License%20(MIT)]]|
!!!Usage
The plugin works more or less like the tab switching in a browser: press {{{ctrl + j}}} or the "jump" command in tiddler toolbar to open the jumping interface and:
* hold {{{ctrl}}} and press {{{j}}} or ↑/↓ arrows to select a tiddler (if more than one is open);
* unhold {{{ctrl}}} or click a row to jump.
This behavior can be switched off with {{{chkDisableJumper}}}: <<option chkDisableJumper>>

It also substitutes the jump toolbar command dropdown with the same jumper interface.
To restore the old behavior, check {{{chkKeepOriginalJumpCommand}}} <<option chkKeepOriginalJumpCommand>> and reload.

As a development of the idea, it also supports hotkeys for some other actions on the tiddler, selected in the jumping interface. Currently, they are:
* {{{x}}} to close the selected tiddler;
* {{{e}}} to edit it.
***/
//{{{
function isKeysMatch(event, hotkeyString) {
	if(!event || !hotkeyString) return false

	const modifierKeys = ['ctrl', 'alt', 'shift', 'meta']

	const hotkey = {}
    for(const mod of modifierKeys) hotkey[mod] = false
	const parts = hotkeyString.split('+')
	for(const part of parts) {
        const maybeModifier = part.toLowerCase()
        if(modifierKeys.includes(maybeModifier)) {
            hotkey[maybeModifier] = true
        } else {
            // * if(hotkey.keycode) already, ... (throw? return false? { problem: 'invalid hotkeyString' }?)
            hotkey.keycode = part.length != 1 ? part :
                'Key' + part
        }
    }

	for(const mod of modifierKeys) {
        const hasEventMod = !!event[mod + 'Key']
        const hasHotkeyMod = !!hotkey[mod]
        if(hasEventMod != hasHotkeyMod) return false
    }

	return hotkey.keycode &&
        event.code.toLowerCase() == hotkey.keycode.toLowerCase()
}

if(!config.jumper) config.jumper = {}
merge(config.jumper, {
	getOpenTiddlersData: function() {
		const list = []
		story.forEachTiddler(function(title, tiddlerElement) {
			list.push({
				title: title, element: tiddlerElement,
				isEditable: !!jQuery(tiddlerElement).has('.editor').length,
				isShadow: tiddlerElement.classList.contains('shadow'),
				isMissing: tiddlerElement.classList.contains('missing')
			})
		})
		this.sortInAccordWithTouchedTiddlersStack(list)
		return list
	},
	getOpenTiddlerDataByIndex: function(index) {
		const list = this.getOpenTiddlersData()
		if(index >= list.length || index < 0) return null
		return list[index]
	},
	jumpToAnOpenTiddler: function(index) {
		const tiddlerData = this.getOpenTiddlerDataByIndex(index)
		if(!tiddlerData) return

		// for compatibility with TiddlersBarPlugin
		if(config.options.chkDisableTabsBar !== undefined)
			story.displayTiddler(null, tiddlerData.title)
		if(tiddlerData.isEditable) {
			const $editor = jQuery(tiddlerData.element).find('.editor textarea')
			// works with CodeMirror as well!
			$editor.focus()
		} else {
			const $title = jQuery(tiddlerData.element).find('.title')
			if($title[0] && $title[0].tabIndex > -1) {
				$title.focus()
			} else {
				window.scrollTo(0, ensureVisible(tiddlerData.element))
				// remove focus from element edited previously
				// (also fixes a problem with handsontable that steals focus on pressing ctrl)
				// will be substitited with focusing an editor when one is to be focused
				if(document.activeElement) document.activeElement.blur()
			}
		}
		this.pushTouchedTiddler({ title: tiddlerData.title })
	},
	callCommand: function(toolbarCommandName, index) {
		const tiddlerData = this.getOpenTiddlerDataByIndex(index)
		if(!tiddlerData) return
		const command = config.commands[toolbarCommandName]
		if(!command || !command.handler) return

		// disable animation so that this methods finishes after closeTiddler etc finishes
		const chkAnimate = config.options.chkAnimate
		config.options.chkAnimate = false
		command.handler(null/*event*/, null/*src*/, tiddlerData.title)
		config.options.chkAnimate = chkAnimate
	},

	touchedTiddlersStack: [], // of { title: string }
	pushTouchedTiddler: function(tiddlerStackElement) {
		this.removeTouchedTiddler(tiddlerStackElement)
		this.touchedTiddlersStack.push(tiddlerStackElement)
	},
	removeTouchedTiddler: function(tiddlerStackElement) {
		this.touchedTiddlersStack = this.touchedTiddlersStack
			.filter(item => item.title != tiddlerStackElement.title)
	},
	sortInAccordWithTouchedTiddlersStack: function(itemsWithTitles) {
		for(var i = 0; i < this.touchedTiddlersStack.length; i++) {
			var touchedTitle = this.touchedTiddlersStack[i].title
			for(var j = 0; j < itemsWithTitles.length; j++)
				if(itemsWithTitles[j].title == touchedTitle)
					itemsWithTitles.unshift(
						itemsWithTitles.splice(j, 1)[0]
					)
		}
	},

	css: store.getTiddlerText("JumpKeysPlugin##Jumper styles", "")
		.replace("//{{{", "/*{{{*/").replace("//}}}", "/*}}}*/"),
	modalClass: 'jump-modal',
	itemClass: 'jump-modal__item',
	selectedItemClass: 'jump-modal__item_selected',
	modal: null,
	isJumperOpen: function() {
		return !!this.modal
	},
	showJumper: function() {
		const openTiddlersData = this.getOpenTiddlersData()
		if(openTiddlersData.length < 2) return false
		if(!this.isJumperOpen()) {
			// TODO: try "modal" element
			this.modal = createTiddlyElement(document.body, 'div', null, this.modalClass)
			this.refreshJumper()
			return true
		} else
			return false
		// return value indicates whether the modal was opened by this call
	},
	refreshJumper: function() {
		if(!this.isJumperOpen()) return
		const openTiddlersData = this.getOpenTiddlersData()
		const $modal = jQuery(this.modal)
			.empty()
		const list = createTiddlyElement(this.modal, 'div', null, this.modalClass + '__list')

		//# find where are we (inside an editor; focus inside tiddlerElement;
		//  scroll between .. and ..)
			for(let i = 0; i < openTiddlersData.length; i++) {
				var listItem = createTiddlyElement(list, 'div', null,
					this.itemClass + (i != 1 ? '' :
					' ' + this.selectedItemClass) +
					(openTiddlersData[i].isShadow ?
					 ' ' + this.itemClass + '_shadow' :
					 openTiddlersData[i].isMissing ?
					 ' ' + this.itemClass + '_missing' : '') +
					 (openTiddlersData[i].isEditable ? 
					 ' ' + this.itemClass + '_editable' : ''),
					openTiddlersData[i].title)
				listItem.onclick = () => {
					this.selectByIndex(i)
					this.hideJumperAndJump()
				}
			}
		//# or append list after forming
	},
	hideJumper: function() {
		if(!this.isJumperOpen()) return
		this.modal.parentElement.removeChild(this.modal)
		//# ..or hide? (keep isJumperOpen coherent)
		this.modal = null
	},

	isCtrlHold: false,
	getSelectedIndex: function() {
		if(!this.isJumperOpen() || !this.modal.firstElementChild) return -1
		return Array.from(this.modal.firstElementChild.children)
			.findIndex(option => option.classList.contains(this.selectedItemClass))
	},
	selectByIndex: function(index) {
		if(!this.isJumperOpen() || !this.modal.firstElementChild) return
		const list = this.modal.firstElementChild

		jQuery(list.children[this.getSelectedIndex()])
			.removeClass(this.selectedItemClass)
		const option = list.children[index]
		jQuery(option).addClass(this.selectedItemClass)

		const stickOutBottom = option.offsetTop + option.offsetHeight - list.offsetHeight
		const stickOutTop = list.scrollTop - option.offsetTop
		if(stickOutBottom > 0) list.scrollTop += stickOutBottom
		if(stickOutTop > 0)    list.scrollTop -= stickOutTop
	},
	selectPrev: function() {
		var currentIndex = this.getSelectedIndex()
		var optionsCount = this.getOpenTiddlersData().length
		this.selectByIndex((currentIndex - 1 + optionsCount) % optionsCount)
	},
	selectNext: function() {
		var currentIndex = this.getSelectedIndex()
		var optionsCount = this.getOpenTiddlersData().length
		this.selectByIndex((currentIndex + 1) % optionsCount)
	},
	hideJumperAndJump: function() {
		if(!this.isJumperOpen()) return

		const index = this.getSelectedIndex()
		this.jumpToAnOpenTiddler(index)
		this.hideJumper()
	},
	handleKeydown: function($event) {
		if(config.options.chkDisableJumper) return
		const self = config.jumper
		if($event.key === 'Control') self.isCtrlHold = true
		if(self.isCtrlHold) self.handleKeydownOnCtrlHold($event)
	},
	// next: make configurable via UI
	defaultCommandsKeys: {
		closeTiddler: "KeyX",
		editTiddler: "KeyE"
	},
	getCommandsKeys: function() {
		const json = store.getTiddlerText('JumpKeysSettings')
		try {
			return JSON.parse(json)
		} catch (error) {
			//# how/where to notify? ..probably after modifying JumpKeysSettings
			// return this.defaultCommandsKeys
		}
	},
	handleKeyup: function($event) {
		if(config.options.chkDisableJumper) return
		const self = config.jumper

		if($event.key === 'Control') {
			self.isCtrlHold = false
			self.hideJumperAndJump()
			return
		}

		const keyCode = $event.originalEvent.code
		if(!self.isJumperOpen() || !keyCode) return

		const commandsKeys = self.getCommandsKeys()
		for(const cName in commandsKeys) {
			if(!self.isCtrlHold || commandsKeys[cName].toLowerCase() != keyCode.toLowerCase()) continue

			const index = self.getSelectedIndex()
			self.callCommand(cName, index)
			const numberOfOpen = self.getOpenTiddlersData().length
			if(numberOfOpen < 1) { // or < 2 ?
				self.hideJumper()
			} else {
				self.refreshJumper()
				self.selectByIndex(index < numberOfOpen ? index : index - 1)
			}
			if($event.preventDefault) $event.preventDefault()
			return false // prevent _
		}
	},
	handleKeydownOnCtrlHold: function($event) {
		// make this work in different keyboard locale layouts:
		if($event.originalEvent.code == "KeyJ") {
			if(!this.showJumper()) this.selectNext()
			if($event.preventDefault) $event.preventDefault()
			return false // prevent _
		}
		if(!this.isJumperOpen()) return

		switch($event.key) {
			case 'ArrowUp':   this.selectPrev(); break
			case 'ArrowDown': this.selectNext(); break
			case 'ArrowLeft': this.hideJumper(); break

			default: return
		}
		if($event.preventDefault) $event.preventDefault()
		return false // prevent _
	},

	substituteJumpCommand: function() {
		if(config.options.chkKeepOriginalJumpCommand) return
		config.commands.jump.type = null
		config.commands.jump.handler = function() {
			config.jumper.showJumper()
		}
	}
})

config.shadowTiddlers['JumpKeysStyleSheet'] = config.jumper.css

// reinstall-safe decorating and setting handlers
if(!config.jumper.orig_story_displayTiddler) {
	config.jumper.orig_story_displayTiddler = story.displayTiddler
	config.jumper.orig_editHandler = config.macros.edit.handler

	store.addNotification('JumpKeysStyleSheet', refreshStyles)
	store.addNotification("ColorPalette", (unused, doc) => refreshStyles('JumpKeysStyleSheet', doc))

	jQuery(document)
		.on('click', event => {
			const element = config.jumper.modal
			if (element && !element.contains(event.target))
				config.jumper.hideJumper()
		})
		//# these are not updated on reinstalling
		.on('keydown', config.jumper.handleKeydown)
		.on('keyup', config.jumper.handleKeyup)
	// avoid stucking ctrl as "hold" on ctrl + f etc
	//# doesn't seem to work anymore
	window.addEventListener('blur', () => config.jumper.isCtrlHold = false)

	for(const cName in config.jumper.defaultCommandsKeys) {
		const command = config.commands[cName]
		if(!command) continue
		command.hotkeys = command.hotkeys || []
		command.hotkeys.push({
			scope: "jumper",
			keys: config.jumper.defaultCommandsKeys[cName]
		})
	}

	config.jumper.substituteJumpCommand()
}
const customizedCommandsKeys = {}
for(const cName in config.commands) {
	const command = config.commands[cName]
	if(!command || !command.hotkeys) continue
	const hotkey = command.hotkeys.find(h => h.scope == "jumper")
	if(hotkey) customizedCommandsKeys[cName] = hotkey.keys
}
config.shadowTiddlers['JumpKeysSettings'] = JSON.stringify(customizedCommandsKeys, null, 2)

// a very simplistic implementation:
story.displayTiddler = function(srcElement, tiddler, template, animate, unused, customFields, toggle, animationSrc) {
	config.jumper.pushTouchedTiddler({
		title: (tiddler instanceof Tiddler) ? tiddler.title : tiddler
		//# ...: template == DEFAULT_EDIT_TEMPLATE
	})
	return config.jumper.orig_story_displayTiddler.apply(this, arguments)
}

// once an element is focused in a tiddler, add the latter to the history top
jQuery(document).on('focusin', '.tiddler', (event) => {
	const $tiddler = jQuery(event.currentTarget)
	config.jumper.pushTouchedTiddler({ title: $tiddler.attr('tiddler') })
})
//}}}
/***
!!!Jumper styles
//{{{
.jump-modal {
	position: fixed;
	top: 50vh;
	left: 50vw;
	transform: translate(-50%, -50%);
	z-index: 100;

	max-width: 80vw;
	max-height: 80vh;
	box-sizing: border-box;

	box-shadow: 1px 1px 10px #ccc;
	border-radius: 1em;
	background: [[ColorPalette::Background]];
	padding: 1em;
	display: flex;
}
.jump-modal__list {
	position: relative;
	overflow: auto;

	list-style: none;
	padding: 0;
	margin: 0;
}
.jump-modal__item {
	padding: 0.3em 0.8em;
	border-radius: 0.5em;
	margin-bottom: 0.5em;
	cursor: pointer;
}
.jump-modal__item_shadow {
	font-weight: bold;
	font-style: italic;
}
.jump-modal__item_missing {
	font-style: italic;
}
.jump-modal__item_editable {
	text-decoration: underline;
}
.jump-modal__item:hover {
	background: [[ColorPalette::SecondaryPale]];
}
.jump-modal__item_selected,
.jump-modal__item_selected:hover {
	background: [[ColorPalette::SecondaryLight]];
}
.darkMode .jump-modal__item:hover {
	background: rgba(0,0,255,0.35);;
}
.jump-modal__item:last-child {
	margin-bottom: 0;
}

.jump-modal ::-webkit-scrollbar {
	background-color: transparent;
	width: 1.5em;
}
.jump-modal ::-webkit-scrollbar-thumb {
	background: [[ColorPalette::TertiaryLight]];
	border-radius: 1em;
	width: 1em;
	border-left: 0.5em solid [[ColorPalette::Background]];
}
//}}}
!!!
***/