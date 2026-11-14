import {api, count, element, stamp} from './common.js';

const form = document.querySelector('#post-form');
const feed = document.querySelector('#guest-feed');
const card = feed.closest('.guestbook');
const feedStatus = document.querySelector('#feed-status');
const pages = document.querySelector('#feed-pages');
const refresh = document.querySelector('#feed-refresh');
const status = document.querySelector('#post-status');
const commentDialog = document.querySelector('#comment-dialog');
const commentForm = document.querySelector('#comment-form');
const commentStatus = document.querySelector('#comment-status');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editStatus = document.querySelector('#edit-status');
const initials = new Intl.Segmenter('ko');

let currentPage = 1;
let pageRequest = 0;
let postDraftId = crypto.randomUUID();
let commentDraft = null;
let savingComment = false;
let editTarget = null;
let savingEdit = false;

function message(target, text, error = false) {
  target.textContent = text;
  target.classList.toggle('error', error);
}

function bindCounter(input, output) {
  function update() {
    const length = count(input.value);
    output.textContent = `${length} / 300`;
    input.setCustomValidity(length > 300 ? '300자 이내로 입력해 주세요.' : '');
  }
  input.addEventListener('input', update);
  return update;
}

const updatePostCount = bindCounter(form.elements.body, document.querySelector('#post-count'));
const updateCommentCount = bindCounter(commentForm.elements.body, document.querySelector('#comment-count'));
const updateEditCount = bindCounter(editForm.elements.body, document.querySelector('#edit-count'));

function setControlsDisabled(target, disabled) {
  for (const control of target.elements) control.disabled = disabled;
}

function formData(target) {
  return {nickname: target.elements.nickname.value, body: target.elements.body.value, password: target.elements.password.value};
}

function button(label, handler, className = 'text-button') {
  const control = element('button', label, className);
  control.type = 'button';
  control.addEventListener('click', handler);
  return control;
}

function header(entry, target, onComment) {
  const heading = element('div', undefined, 'note-heading');
  const meta = element('div', undefined, 'note-meta');
  const date = element('time', stamp(entry.created_at));
  date.dateTime = entry.created_at;
  const actions = element('div', undefined, 'note-actions');
  if (onComment) actions.append(button('댓글', onComment, 'text-button comment-create'));
  actions.append(button('수정', () => openEdit(target, false)), button('삭제', () => openEdit(target, true)));
  meta.append(date, actions);
  const name = element('strong', entry.nickname);
  name.title = entry.nickname;
  heading.append(name, meta);
  return heading;
}

function commentItem(entry, thread) {
  const item = element('article', undefined, 'guest-comment');
  const initial = initials.segment(entry.nickname).containing(0)?.segment || '·';
  const avatar = element('span', initial, 'comment-avatar');
  avatar.setAttribute('aria-hidden', 'true');
  const content = element('div');
  const target = {entry, path: `${thread.path}/${entry.id}`, thread};
  content.append(header(entry, target), element('p', entry.body));
  item.append(avatar, content);
  return item;
}

function updateThreadLabel(thread, count) {
  thread.count = count;
  thread.toggle.textContent = thread.panel.hidden ? `댓글 ${count}개 보기` : `댓글 ${count}개 접기`;
  thread.toggle.setAttribute('aria-expanded', String(!thread.panel.hidden));
  thread.toggle.hidden = count === 0 && thread.panel.hidden;
}

async function loadThread(thread, offset = 0) {
  if (thread.loading) {
    // A saved comment must refresh after any earlier reads have finished.
    if (offset === 0) thread.reload = true;
    return;
  }
  thread.loading = true;
  thread.more.disabled = true;
  thread.panel.setAttribute('aria-busy', 'true');
  message(thread.status, '댓글을 불러오는 중이에요.');
  try {
    const data = await api(`${thread.path}?offset=${offset}`);
    if (!thread.panel.isConnected) return;
    const items = data.comments.map(entry => commentItem(entry, thread));
    if (offset === 0) thread.list.replaceChildren(...items);
    else thread.list.append(...items);
    thread.next = data.next;
    thread.more.hidden = data.next == null;
    updateThreadLabel(thread, data.count);
    message(thread.status, data.count === 0 ? '아직 댓글이 없어요.' : '');
  } catch (error) {
    message(thread.status, error.message, true);
  } finally {
    thread.loading = false;
    thread.more.disabled = false;
    thread.panel.setAttribute('aria-busy', 'false');
    if (thread.reload && thread.panel.isConnected) {
      thread.reload = false;
      void loadThread(thread);
    }
  }
}

function note(post) {
  const article = element('article', undefined, 'note');
  const path = `/posts/${post.id}`;
  const panel = element('div', undefined, 'comment-thread');
  panel.id = `comments-${post.id}`;
  panel.hidden = true;
  const list = element('div', undefined, 'comment-list');
  const threadStatus = element('p', undefined, 'status');
  threadStatus.setAttribute('role', 'status');
  const thread = {post, path: `${path}/comments`, panel, list, status: threadStatus, next: null, loading: false, reload: false};
  thread.more = button('댓글 더 보기', () => void loadThread(thread, thread.next), 'text-button comment-more');
  thread.more.hidden = true;
  thread.toggle = button('', () => {
    panel.hidden = !panel.hidden;
    updateThreadLabel(thread, thread.count);
    if (!panel.hidden) void loadThread(thread);
  }, 'text-button thread-toggle');
  thread.toggle.setAttribute('aria-controls', panel.id);
  updateThreadLabel(thread, post.comment_count || 0);
  panel.append(list, threadStatus, thread.more);
  const target = {entry: post, path, thread: null};
  article.append(header(post, target, () => openComment(thread)), element('p', post.body, 'note-body'), thread.toggle, panel);
  return article;
}

function pageUrl(page) {
  const url = new URL(window.location.href);
  if (page === 1) url.searchParams.delete('guest-page');
  else url.searchParams.set('guest-page', page);
  url.hash = 'guest-feed-title';
  return url;
}

function pageFromUrl() {
  const page = Number(new URL(window.location.href).searchParams.get('guest-page'));
  return Number.isInteger(page) && page >= 1 && page <= 2147483647 ? page : 1;
}

function showPages(page, total) {
  pages.hidden = total <= 1;
  pages.replaceChildren();
  if (total <= 1) return;

  const first = Math.max(1, page - 2);
  const last = Math.min(total, page + 2);
  const shown = new Set([1, total]);
  for (let number = first; number <= last; number++) shown.add(number);
  let previous = 0;
  for (const number of [...shown].sort((left, right) => left - right)) {
    if (number > previous + 1) pages.append(element('span', '…', 'muted'));
    const link = element('a', `${number}페이지`);
    link.href = pageUrl(number).href;
    if (number === page) link.setAttribute('aria-current', 'page');
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      void loadPage(number, {navigate: true});
    });
    pages.append(link);
    previous = number;
  }
}

async function loadPage(page = currentPage, {navigate = false} = {}) {
  const request = ++pageRequest;
  refresh.disabled = true;
  feed.setAttribute('aria-busy', 'true');
  message(feedStatus, '');
  try {
    const data = await api(`/posts?page=${page}`);
    if (request !== pageRequest) return;
    const items = data.posts.map(note);
    currentPage = data.page;
    feed.replaceChildren(...(items.length ? items : [element('p', '첫 이야기를 남겨주세요.', 'muted')]));
    showPages(currentPage, data.total_pages);
    feed.scrollTop = 0;
    if (navigate) {
      const url = pageUrl(currentPage);
      if (url.href !== window.location.href) history.pushState(null, '', url);
      feed.focus({preventScroll: true});
    } else if (pageFromUrl() !== currentPage) {
      const url = pageUrl(currentPage);
      url.hash = window.location.hash;
      history.replaceState(null, '', url);
    }
  } catch (error) {
    if (request !== pageRequest) return;
    if (!feed.querySelector('.note')) feed.replaceChildren(element('p', error.message, 'muted'));
    else message(feedStatus, error.message, true);
  } finally {
    if (request === pageRequest) {
      refresh.disabled = false;
      feed.setAttribute('aria-busy', 'false');
    }
  }
}

function fitFeed() {
  const style = getComputedStyle(card);
  const beforeList = feed.getBoundingClientRect().top - card.getBoundingClientRect().top;
  const afterList = parseFloat(style.paddingBlockEnd) + parseFloat(style.borderBlockEndWidth);
  card.style.setProperty('--guestbook-fixed-height', `${beforeList + afterList}px`);
}

// Watch the parts outside the list so loading another page does not change its available space.
const feedLayout = new ResizeObserver(fitFeed);
for (const child of card.children) {
  if (child === feed) break;
  feedLayout.observe(child);
}
window.addEventListener('resize', fitFeed);
refresh.addEventListener('click', () => void loadPage());
window.addEventListener('popstate', () => void loadPage(pageFromUrl()));

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const data = formData(form);
  setControlsDisabled(form, true);
  message(status, '글을 남기는 중이에요…');
  try {
    await api('/posts', {method: 'POST', body: {...data, id: postDraftId}});
    form.elements.body.value = '';
    form.elements.password.value = '';
    postDraftId = crypto.randomUUID();
    updatePostCount();
    message(status, '이야기를 남겼어요. 고맙습니다.');
    await loadPage(1);
  } catch (error) {
    message(status, error.message, true);
  } finally {
    setControlsDisabled(form, false);
  }
});

function openComment(thread) {
  if (savingComment || commentDialog.open) return;
  commentDraft = {thread, id: crypto.randomUUID()};
  commentForm.reset();
  document.querySelector('#comment-parent-name').textContent = thread.post.nickname;
  document.querySelector('#comment-parent-text').textContent = thread.post.body;
  message(commentStatus, '');
  updateCommentCount();
  commentDialog.showModal();
  commentForm.elements.nickname.focus();
}

document.querySelector('#comment-close').addEventListener('click', () => commentDialog.close());
commentForm.addEventListener('input', () => {
  if (commentStatus.classList.contains('error')) message(commentStatus, '');
});
commentDialog.addEventListener('cancel', event => { if (savingComment) event.preventDefault(); });
commentDialog.addEventListener('close', () => {
  commentDraft = null;
  commentForm.elements.password.value = '';
});

commentForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (savingComment || !commentDraft || !commentForm.reportValidity()) return;
  const {thread, id} = commentDraft;
  const data = formData(commentForm);
  savingComment = true;
  setControlsDisabled(commentForm, true);
  message(commentStatus, '댓글을 남기는 중이에요…');
  try {
    await api(thread.path, {method: 'POST', body: {...data, id}});
    commentDialog.close();
    message(feedStatus, '댓글을 남겼어요.');
    if (thread.panel.isConnected) {
      thread.panel.hidden = false;
      updateThreadLabel(thread, thread.count);
      await loadThread(thread);
    } else await loadPage();
  } catch (error) {
    message(commentStatus, error.message, true);
  } finally {
    savingComment = false;
    setControlsDisabled(commentForm, false);
  }
});

function openEdit(target, deleting) {
  if (savingEdit || editDialog.open) return;
  editTarget = target;
  const kind = target.thread ? '댓글' : '글';
  document.querySelector('#edit-title').textContent = `내 ${kind} ${deleting ? '삭제' : '수정'}`;
  document.querySelector('#edit-body-label').textContent = `${kind} 내용`;
  document.querySelector('#edit-password-label').textContent = `이 ${kind}의 비밀번호`;
  document.querySelector('#post-delete').textContent = `내 ${kind} 삭제`;
  document.querySelector('#edit-delete-hint').textContent = target.thread
    ? '댓글을 삭제하면 되돌릴 수 없습니다.' : '글을 삭제하면 그 글의 댓글도 함께 삭제됩니다.';
  editForm.elements.nickname.value = target.entry.nickname;
  editForm.elements.body.value = target.entry.body;
  editForm.elements.password.value = '';
  message(editStatus, deleting ? `삭제할 ${kind}을 확인하고 비밀번호를 입력해 주세요.` : '');
  updateEditCount();
  editDialog.showModal();
  editForm.elements.password.focus();
}

document.querySelector('#edit-close').addEventListener('click', () => editDialog.close());
editDialog.addEventListener('cancel', event => { if (savingEdit) event.preventDefault(); });
editDialog.addEventListener('close', () => {
  editTarget = null;
  editForm.elements.password.value = '';
});

async function change(deleting) {
  if (savingEdit || !editTarget || !editForm.reportValidity()) return;
  const {entry, path, thread} = editTarget;
  const kind = thread ? '댓글' : '글';
  const warning = thread ? '이 댓글을 삭제할까요?' : '이 글과 댓글을 함께 삭제할까요?';
  if (deleting && !confirm(warning)) return;

  const data = formData(editForm);
  savingEdit = true;
  setControlsDisabled(editForm, true);
  message(editStatus, deleting ? '삭제하는 중이에요…' : '수정 내용을 저장하는 중이에요…');
  try {
    await api(path, {method: deleting ? 'DELETE' : 'PATCH', body: {...data, revision: entry.revision}});
    editDialog.close();
    const result = deleting ? `${kind}을 삭제했습니다.` : `${kind} 수정을 저장했습니다.`;
    if (thread) {
      message(feedStatus, result);
      if (thread.panel.isConnected) await loadThread(thread);
      else await loadPage();
    } else {
      message(status, result);
      await loadPage();
    }
  } catch (error) {
    message(editStatus, error.message, true);
  } finally {
    savingEdit = false;
    setControlsDisabled(editForm, false);
  }
}

editForm.addEventListener('submit', event => { event.preventDefault(); void change(false); });
document.querySelector('#post-delete').addEventListener('click', () => void change(true));
fitFeed();
void loadPage(pageFromUrl());
