const API_TOKEN = 'Your OpenAI API Key'

(function () {
    'use strict';

    let enableInsertRomaji = true;

    const excludeTags = new Set(['ruby', 'rt', 'script', 'select', 'option', 'textarea']);

    // ============== observe ==============
    let domChanged = false;
    const observer = new MutationObserver(mutations => {
        if (!enableInsertRomaji) {
            return;
        }
        if (domChanged) {
            return;
        }
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                if (excludeTags.has(node.nodeName.toLowerCase())) {
                    continue;
                }
                const parent = node.parentNode;
                if (parent) {
                    if (excludeTags.has(parent.nodeName.toLowerCase())) {
                        continue;
                    }
                    if (parent.classList && parent.classList.contains('explanation')) {
                        continue;
                    }
                }

                domChanged = true;
                setTimeout(function () {
                    if (!domChanged) {
                        return;
                    }
                    try {
                        scanDocument();
                    } finally {
                        domChanged = false;
                    }
                }, 100);
                return;
            }
        }
    });

    

    function deleteRubies() {
        const excludeTags = new Set(['script', 'select', 'textarea']);

        function scanRubyNodes(node) {
            if (excludeTags.has(node.nodeName.toLowerCase())) {
                return;
            }
            if (node.nodeName.toLowerCase() === 'ruby') {
                if (node.classList.contains('definite-translation')) {
                    const parent = node.parentNode;
                    const textNode = Array.from(node.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                    if (textNode) {
                        parent.replaceChild(textNode, node);
                    }
                }
                return;
            }
            if (node.hasChildNodes()) {
                node.childNodes.forEach(scanRubyNodes);
            }
        }

        scanRubyNodes(document.body);
    }   

    // ============== translate and explain the text ==============
    const API_URL = 'https://api.openai.com/v1/chat/completions'; // Use the correct endpoint for OpenAI's API
    // const API_TOKEN = 'sk-proj-JTBFU28Zd0s3mLC7WvT2T3BlbkFJpsqOMyinNFK32SsRwRol'

    async function translateAndExplain(text) {
        const systemPrompt = "You are a highly capable language translation assistant.\
          Your task is to translate the given text from any language to English, \
          and provide a word-by-word breakdown with the meaning and part of speech for each word. \
          Follow the specified output format strictly and replace the content in the \
          brackets with them. \
          Format the response with each segment enclosed in brackets:\
          - [Full Translation]\
          - Followed by a series of entries formatted as:\
          [Word in Chinese][Pronunciation][English Translation][Part of Speech][Explanations like further breakdowns]\
          \
          Example text: 我爱你。\
          Output: \
          Full Translation: [I love you]\
          Word:[我],pnc:[wǒ],trns,[I],POS:[Pronoun],Exp:[Subject of the sentence, indicating the speaker]\
          Word:[爱],pnc:[ài],trns,[love],POS:[Verb],Exp:[Action verb indicating the feeling of love]\
          Word:[你],pnc:[nǐ],trns,[you],POS:[Pronoun],Exp:[Direct object of the verb, indicating the recipient of the love]"
      ;
      
        const prompt = text;
      
        const response = await fetch(API_URL, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
          },
          method: 'POST',
          body: JSON.stringify({
            model: 'gpt-3.5-turbo', // or any other suitable model
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1024, // adjust as needed
            temperature: 0.9, // adjust as needed
          })
        });
      
        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content;
        } else {
          console.error(`Failed to fetch translation: ${await response.text()}`);
          return 'Translation failed'; // Handling translation failure
        }
    }

    //========== parse API output ===========
    async function parseTranslation(input) {
        console.log("parse function: "+ input);
        const entries = input.match(/\[(.*?)\]/g).map(entry => entry.slice(1, -1));;
        console.log("entries: " + entries);
      
        let fullTranslation;
        if (entries[0] === "Full Translation") {
            entries.shift(); // Remove "Full Translation" from the entries array
            fullTranslation = entries.shift(); // Get the next entry as fullTranslation
        } else {
            fullTranslation = entries.shift(); // Get the first entry as fullTranslation
        }

        console.log("FT: " + fullTranslation);
      
        var words = [];
        var pinyin = [];
        var translations = [];
        var partsOfSpeech = [];
        var definitions = [];
      
        for (let i = 0; i < entries.length; i += 5) {
          words.push(entries[i]); 
          console.log("words entries i: " + entries[i]);

          pinyin.push(entries[i + 1]);
          console.log("pinyin entriers i + 1: " + entries[i + 1]);

          translations.push(entries[i + 2]);
          console.log("trans entriers i + 2: " + entries[i + 2]);

          partsOfSpeech.push(entries[i + 3]);
          console.log("pos entriers i + 3: " + entries[i + 3]);

          definitions.push(entries[i + 4]);
          console.log("def entriers i + 4 slice: " + entries[i + 4]);
        }
      
        return {
          fullTranslation,
          words,
          pinyin,
          translations,
          partsOfSpeech,
          definitions
        };
    }

    scanDocument();
    // ============== scan document ==============
    function scanDocument() {
        const stack = [document.body];
        const textNodes = [];
        for (; ;) {
            const node = stack.shift();
            if (!node) {
                break;
            }
            if (node.classList && node.classList.contains('explanation')) {
                continue;
            }
            if (node.hasChildNodes()) {
                const childNodes = node.childNodes;
                for (let i = 0, len = childNodes.length; i < len; ++i) {
                    const child = childNodes.item(i);
                    if (!excludeTags.has(child.nodeName.toLowerCase())) {
                        stack.push(child);
                    }
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                textNodes.push(node);
            }
        }; 
        console.log("textNodes:", textNodes);
        for (let i = 0, len = textNodes.length; i < len; ++i) {
            createRuby(textNodes[i]);
        }
    }
    
    // ======== filter Non Whitespace Strings ============
    function fnwss(input) {
        // 1. If the input is a string, convert it to an array of characters
        const characters = typeof input === 'string' ? input.split('') : input; 
      
        // 2. Filter out the characters that are entirely whitespace
        const filteredCharacters = characters.filter(char => /\S/.test(char));
      
        // 3. Check if there are remaining characters and return accordingly
        return filteredCharacters.length > 0 ? input : ''; 
      }

    // ============== create ruby ==============
    async function createRuby(node) {
        const text = fnwss(node.nodeValue);
        console.log("text: |" + text+"|");
       
        
        if (text){
            console.log("there is clearly text: " + text);
            var translation = await translateAndExplain(text);
            console.log("API output:" + translation);
            var {
                fullTranslation,
                words,
                pronunciation,
                translations,
                partsOfSpeech,
                definitions
            } = await parseTranslation(translation);
            console.log("fulltrans: " + fullTranslation);
            console.log("words: " + words);
            console.log("partsOfSpeech: " + partsOfSpeech);
            console.log("pronunciation: " + pronunciation);
        }
        else{
            //console.log("nothing");
            return;
            
            
        }

        
        const posToClass = {
            "Noun": "pos-noun",
            "Pronoun": "pos-pronoun",
            "Proper Noun": "pos-proper-noun",
            "Verb": "pos-verb",
            "Auxiliary Verb": "pos-auxiliary-verb",
            "Modal Verb": "pos-modal-verb",
            "Adjective": "pos-adjective",
            "Comparative Adjective": "pos-comparative-adjective",
            "Superlative Adjective": "pos-superlative-adjective",
            "Adverb": "pos-adverb",
            "Comparative Adverb": "pos-comparative-adverb",
            "Superlative Adverb": "pos-superlative-adverb",
            "Adposition": "pos-adposition",
            "Conjunction": "pos-conjunction",
            "Determiner": "pos-determiner",
            "Numeral": "pos-numeral",
            "Particle": "pos-particle",
            "Interjection": "pos-interjection",
            "Punctuation": "pos-punctuation"
        };

        
        const parent = node.parentNode;
        if (!parent) {
            return;
        }

        if (!parent.classList.contains('original-text')) { 
            parent.classList.add('original-text');
        }

        
        let result = [];
        let currentIndex = 0;
        for (const word of words) {
            const wordIndex = node.textContent.indexOf(word, currentIndex);
            if (wordIndex !== -1) {
                // Add any characters between the previous word and this word
                if (wordIndex > currentIndex) {
                result.push(node.textContent.substring(currentIndex, wordIndex));
                }
        
                result.push(word); // Add the matched word
                currentIndex = wordIndex + word.length; // Update the current index
            };
        };
        
            // Add any remaining characters after the last matched word
        if (currentIndex < node.length) {
            result.push(node.textContent.substring(currentIndex));
        };
        console.log("RESTULS: " + result);

        

        let domFragments = []; 

        for (let i = 0; i < result.length; i++) {
            const word = result[i];
            let dom;
      
            if (words.includes(word)) {
                // Create ruby element for words in the 'words' array
                console.log("=== Includes Word ====");
                dom = document.createElement('ruby');
                dom.classList.add('definite-translation');
                //dom.classList.add("pos-adjective");
                dom.classList.add(posToClass[partsOfSpeech[words.indexOf(word)]]);
                dom.appendChild(document.createTextNode(word));
                console.log("POS full: " + partsOfSpeech);
                console.log("what color: "+ posToClass[partsOfSpeech[words.indexOf(word)]] + "|" + partsOfSpeech[words.indexOf(word)] + "|");
                const rt = document.createElement('rt');
                rt.textContent = translations[words.indexOf(word)];
                console.log("Last Trans: " + translations[words.indexOf(word)]);
                dom.appendChild(rt);
            } else {
                // Create text node for other words
                dom = document.createTextNode(word);
                console.log("=== Skipped Word ===");
            }
        
            domFragments.push(dom);
            if (i === 0) {
                parent.replaceChild(dom, node);
                } else {
                    node.after(dom);
            }
            node = dom;
        }
    }

    // ============== google translate ==============
    const googleTranslateCache = {};

    function googleTranslate(sLang, tLang, text) {
        text = (text || '').trim();
        const hash = `${tLang}/${text}`
        if (googleTranslateCache.hasOwnProperty(hash)) {
            return googleTranslateCache[hash];
        }
        return googleTranslateCache[hash] = new Promise(function (resolve) {
            const url = `https://clients5.google.com/translate_a/single?dj=1&dt=t&dt=sp&dt=ld&dt=bd&client=dict-chrome-ex&sl=${sLang}&tl=${tLang}&q=${encodeURIComponent(text)}`;
            chrome.runtime.sendMessage({type: 'fetch-json', content: url}, function (json) {
                resolve(json);
            });
        });
    }

    // ============== translation ==============
    const translationDom = document.createElement('div');
    translationDom.classList.add('explanation');
    document.body.appendChild(translationDom);

    // ============== get mouseover ruby ==============
    let currHoverNode = null;
    document.addEventListener('mouseover', async function (e) {
        translationDom.classList.remove('show');
        let node = e.target;
        if (!node) {
            return;
        }
        if (node.nodeName.toLowerCase() === 'rt') {
            node = node.parentNode;
        }
        currHoverNode = node;
        if (node.nodeName.toLowerCase() === 'ruby'
            && node.classList.contains('definite-translation')
        ) {
            const configs = await new Promise(function (resolve) {
                chrome.storage.sync.get(resolve);
            });
            if (configs['translationDisabled']) {
                return;
            }

            await new Promise(function (resolve) {
                setTimeout(resolve, 200);
            });

            if (currHoverNode !== node) {
                return;
            }
            const textNode = Array.from(node.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (!textNode) {
                return;
            }
            const text = textNode.data || '';
            const res = await googleTranslate('ja', configs['targetLang'] || 'en', text);
            if (res.dict?.length) {
                translationDom.innerHTML = res.dict.map(item =>
                    item.pos + ' ' + item.entry.map(item => item.word).join(', ')
                ).join('<br>');
            } else if (res.sentences?.length) {
                translationDom.innerHTML = res.sentences.map(item => item.trans).join(', `');
            } else {
                return;
            }

            const rect = node.getBoundingClientRect();
            translationDom.style.top = (rect.bottom + 2) + 'px';
            translationDom.style.left = rect.left + 'px';
            translationDom.classList.add('show');
        }
    });

    document.addEventListener('scroll', function () {
        translationDom.classList.remove('show');
    });
})();