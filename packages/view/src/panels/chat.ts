import type { LogLine } from '../client/log.ts';
import { clear, element, fieldId, type PanelView } from './dom.ts';
import type { PanelContext } from './panels.ts';

const CHANNEL_COMMANDS: readonly string[] = ['/speak', '/vessel', '/crew'];
const COMMAND_PREFIX = /^\/[a-z]+/i;

export function createChatBar(context: PanelContext, host: HTMLElement): PanelView {
  const client = context.client;
  const root = element('div', 'pp-chat');
  const history = element('div', 'pp-chat-history');
  const form = element('form', 'pp-chat-form');
  const channel = element('select', 'pp-chat-channel');
  const channelLabel = element('label', 'pp-chat-label', 'Channel');
  const input = element('input', 'pp-chat-input');
  const inputLabel = element('label', 'pp-chat-label', 'Say');

  history.setAttribute('role', 'log');
  history.setAttribute('aria-label', 'Chat history');

  channel.id = fieldId('pp-channel');
  channelLabel.htmlFor = channel.id;
  for (const command of CHANNEL_COMMANDS) {
    const option = element('option', 'pp-chat-option', command);
    option.value = command;
    channel.append(option);
  }

  input.id = fieldId('pp-say');
  input.type = 'text';
  input.autocomplete = 'off';
  inputLabel.htmlFor = input.id;

  const send = element('button', 'pp-button pp-chat-send', 'Send');
  send.type = 'submit';

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    speak();
  });

  form.append(channelLabel, channel, inputLabel, input, send);
  root.append(history, form);
  host.append(root);
  refresh();

  function speak(): void {
    const text = input.value.trim();
    if (text === '') return;
    client.say(COMMAND_PREFIX.test(text) ? text : `${channel.value} ${text}`);
    input.value = '';
  }

  function refresh(): void {
    clear(history);
    for (const line of client.log) history.append(lineElement(line));
    history.scrollTop = history.scrollHeight;
  }

  return {
    root,
    refresh,
    destroy(): void {
      root.remove();
    },
  };
}

function lineElement(line: LogLine): HTMLElement {
  const row = element('p', `pp-chat-line pp-chat-${line.channel}`);
  row.append(
    element('span', 'pp-chat-tick', String(line.tick)),
    element('span', 'pp-chat-text', line.text),
  );
  return row;
}
