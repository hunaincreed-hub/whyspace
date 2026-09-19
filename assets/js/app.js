const form = document.querySelector('#generator-form');
const promptInput = document.querySelector('#prompt');
const response = document.querySelector('#response');
const count = document.querySelector('#count');
const copyButton = document.querySelector('#copy-button');

function generateResponse(prompt) {
  const subject = prompt.replace(/\s+/g, ' ').trim();
  const opening = [
    'Here is a clear place to begin:',
    'Let’s give that idea some shape:',
    'A thoughtful first response:'
  ][Math.floor(Math.random() * 3)];
  return `${opening}\n\n${subject}\n\nStart with what matters most, say it in human language, and leave room for the next useful question. The best response is not always the longest one—it is the one that helps someone move forward.`;
}

promptInput.addEventListener('input', () => { count.textContent = `${promptInput.value.length} / 600`; });
document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => {
  promptInput.value = button.dataset.prompt;
  promptInput.dispatchEvent(new Event('input'));
  promptInput.focus();
}));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  response.textContent = generateResponse(promptInput.value);
  copyButton.disabled = false;
});
copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(response.textContent);
  copyButton.textContent = 'Copied';
  setTimeout(() => { copyButton.textContent = 'Copy'; }, 1400);
});
