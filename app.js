const form = document.querySelector("#composer");
const input = document.querySelector("#message-input");
const conversation = document.querySelector(".conversation");
const newChat = document.querySelector("#new-chat");
const suggestions = document.querySelector(".suggestion-list");

function addMessage(text) {
  const message = document.createElement("div");
  message.className = "message user-message";
  message.innerHTML = `
    <div class="message-meta"><span class="avatar user-avatar">AM</span><span>You</span><span class="message-time">now</span></div>
    <p>${text.replace(/[<>&]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[character]))}</p>
  `;
  conversation.insertBefore(message, document.querySelector(".assistant-message"));
  input.value = "";
  input.style.height = "auto";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text) addMessage(text);
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
});

suggestions.addEventListener("click", (event) => {
  const button = event.target.closest(".suggestion");
  if (!button) return;
  input.value = button.textContent.replace("→", "").trim();
  input.focus();
});

newChat.addEventListener("click", () => {
  input.value = "";
  input.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
