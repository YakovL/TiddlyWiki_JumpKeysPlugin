/***
|Description|Adds an interface and hotkeys for jumping between tiddlers and more|
|Source     |https://github.com/YakovL/TiddlyWiki_JumpKeysPlugin/blob/master/JumpKeysPlugin.js|
|Author     |Yakov Litvin|
|Version    |1.2.0|
|License    |[[MIT|https://github.com/YakovL/TiddlyWiki_YL_ExtensionsCollection/blob/master/Common%20License%20(MIT)]]|
!!!Usage
The plugin works more or less like the tab switching in a browser: press {{{ctrl + j}}} or the "jump" command in tiddler toolbar to open the jumping interface and:
* hold {{{ctrl}}} and press {{{j}}} or ↑/↓ arrows to select a tiddler;
* unhold {{{ctrl}}} or click a row to jump.
TODO: explain other hotkeys/and features of UI
***/
//{{{
if(!config.jumper) config.jumper = {};
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
			window.scrollTo(0, ensureVisible(tiddlerData.element))
			// remove focus from element edited previously
			// (also fixes a problem with handsontable that steals focus on pressing ctrl)
			// will be substitited with focusing an editor when one is to be focused
			if(document.activeElement) document.activeElement.blur()
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
			var touchedTitle = this.touchedTiddlersStack[i].title;
			for(var j = 0; j < itemsWithTitles.length; j++)
				if(itemsWithTitles[j].title == touchedTitle)
					itemsWithTitles.unshift(
						itemsWithTitles.splice(j, 1)[0]
					);
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
	handleKeydown: function(e) {
		const self = config.jumper
		if(e.key === 'Control') self.isCtrlHold = true
		if(self.isCtrlHold) self.handleKeydownOnCtrlHold(e)
	},
	// next: make configurable via UI
	defaultCommandsKeys: {
		x: "closeTiddler",
		e: "editTiddler"
	},
	getCommandsKeys: function() {
		const json = store.getTiddlerText('JumpKeysSettings')
		try {
			return JSON.parse(json)
		} catch {
			//# how/where to notify? ..probably after modifying JumpKeysSettings
			// return this.defaultCommandsKeys
		}
	},
	handleKeyup: function(e) {
		const self = config.jumper

		if(e.key === 'Control') {
			self.isCtrlHold = false
			self.hideJumperAndJump()
			return
		}

		const normalizedKeyCode = !e.originalEvent.code ? null :
			/^(Key)?(\w+)$/.exec(e.originalEvent.code)[2].toLowerCase()

		const commandsKeys = self.getCommandsKeys()
		if(self.isCtrlHold && self.isJumperOpen() && normalizedKeyCode in commandsKeys) {

			const index = self.getSelectedIndex()
			self.callCommand(commandsKeys[normalizedKeyCode], index)
			const numberOfOpen = self.getOpenTiddlersData().length
			if(numberOfOpen < 1) { // or < 2 ?
				self.hideJumper()
			} else {
				self.refreshJumper()
				self.selectByIndex(index < numberOfOpen ? index : index - 1)
			}
			if(e.preventDefault) e.preventDefault()
			return false // prevent _
		}
	},
	handleKeydownOnCtrlHold: function(e) {
		// make this work in different keyboard locale layouts:
		if(e.originalEvent.code == "KeyJ") {
			if(!this.showJumper()) this.selectNext()
			if(e.preventDefault) e.preventDefault()
			return false // prevent _
		}
		if(!this.isJumperOpen()) return

		switch(e.key) {
			case 'ArrowUp':   this.selectPrev(); break
			case 'ArrowDown': this.selectNext(); break
			case 'ArrowLeft': this.hideJumper(); break

			default: return
		}
		if(e.preventDefault) e.preventDefault()
		return false // prevent _
	},

	substituteJumpCommand: function() {
		config.commands.jump.type = null
		config.commands.jump.handler = function() {
			config.jumper.showJumper()
		}
	}
})

config.shadowTiddlers['JumpKeysStyleSheet'] = config.jumper.css
config.shadowTiddlers['JumpKeysSettings'] = JSON.stringify(config.jumper.defaultCommandsKeys, null, 2)

// reinstall-safe hijacking
if(!config.jumper.orig_story_onTiddlerKeyPress) {
	config.jumper.orig_story_onTiddlerKeyPress = story.onTiddlerKeyPress
	config.jumper.orig_story_displayTiddler = story.displayTiddler

	store.addNotification('JumpKeysStyleSheet', refreshStyles)
	store.addNotification("ColorPalette", (smth, doc) => refreshStyles('JumpKeysStyleSheet', doc))

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

	config.jumper.substituteJumpCommand()
}

// a very simplistic implementation:
story.displayTiddler = function(srcElement, tiddler, template, animate, unused, customFields, toggle, animationSrc) {
	config.jumper.pushTouchedTiddler({
		title: (tiddler instanceof Tiddler) ? tiddler.title : tiddler
		//# ...: template == DEFAULT_EDIT_TEMPLATE
	})
	return config.jumper.orig_story_displayTiddler.apply(this, arguments)
}
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