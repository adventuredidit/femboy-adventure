// Simple word lists for generating readable IDs
const adjectives = [
    'happy', 'red', 'blue', 'green', 'purple', 'golden', 'silver', 'shiny',
    'dark', 'bright', 'cool', 'warm', 'wild', 'brave', 'calm', 'swift',
    'fancy', 'kind', 'quick', 'soft', 'bold', 'wise', 'pure', 'proud'
];

const nouns = [
    'panda', 'tiger', 'wolf', 'bear', 'eagle', 'lion', 'owl', 'fox',
    'dragon', 'phoenix', 'hawk', 'deer', 'cat', 'dog', 'bird', 'fish',
    'star', 'moon', 'sun', 'cloud', 'rain', 'snow', 'wind', 'storm'
];

function generateReadableId() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000); // 0-999
    return `${noun}-${adj}-${num}`;
}

module.exports = {
    generateReadableId
};