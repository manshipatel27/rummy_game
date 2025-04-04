const suits  = ["♠️", "♥️", "♦️", "♣️"];
const ranks  = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const jokers = ["🃏", "🃏"];

function createDeck() {
    let deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push(`${suit}${rank}`);
        }
    }
    deck = deck.concat(jokers);
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}


module.exports = { createDeck, shuffleDeck };



