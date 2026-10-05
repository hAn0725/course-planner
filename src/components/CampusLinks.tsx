import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe, GripVertical, Plus, Trash2, X } from 'lucide-react';

const SITES_STORAGE_KEY = 'course_planner_private_sites_v1';

type PrivateSite = { id: string; name: string; href: string };

function loadSites(): PrivateSite[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SITES_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((site): site is PrivateSite =>
      !!site && typeof site.id === 'string' && typeof site.name === 'string' &&
      typeof site.href === 'string' && /^https?:\/\//i.test(site.href));
  } catch {
    return [];
  }
}

export const CampusLinks: React.FC = () => {
  const [sites, setSites] = useState<PrivateSite[]>(loadSites);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [href, setHref] = useState('');
  const [draggedSite, setDraggedSite] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(SITES_STORAGE_KEY, JSON.stringify(sites));
    } catch {
      // Sites remain available for the current session if local storage is unavailable.
    }
  }, [sites]);

  const moveSite = (source: string, target: string) => {
    if (!source || source === target) return;
    setSites(current => {
      const from = current.findIndex(site => site.id === source);
      const to = current.findIndex(site => site.id === target);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [site] = next.splice(from, 1);
      next.splice(to, 0, site);
      return next;
    });
  };

  const saveSite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    try {
      const parsed = new URL(href.trim());
      if (!cleanName || !['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      setSites(current => [...current, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: cleanName, href: parsed.href }]);
      setName('');
      setHref('');
      setError('');
      setIsAdding(false);
    } catch {
      setError('请输入名称和有效的 http/https 链接');
    }
  };

  return (
    <nav aria-label="快捷网站" className="campus-launcher">
      <div className="campus-launcher-heading">
        <span className="campus-launcher-label">快捷网站</span>
        <button type="button" className="campus-launcher-add" onClick={() => { setIsAdding(value => !value); setError(''); }}>
          {isAdding ? <X size={12} /> : <Plus size={12} />}
          <span>{isAdding ? '取消' : '添加'}</span>
        </button>
      </div>
      <p className="campus-launcher-hint">仅保存在本机，可拖动排序</p>
      {isAdding && (
        <form className="campus-launcher-form" onSubmit={saveSite}>
          <input aria-label="网站名称" value={name} onChange={event => setName(event.target.value)} placeholder="网站名称" maxLength={32} required />
          <input aria-label="网站链接" value={href} onChange={event => setHref(event.target.value)} placeholder="https://…" type="url" required />
          {error && <span className="campus-launcher-error" role="alert">{error}</span>}
          <button type="submit">保存到本机</button>
        </form>
      )}
      <div className="campus-launcher-links">
        {sites.map(site => (
          <div
            key={site.id}
            className={`campus-launcher-link ${draggedSite === site.id ? 'is-dragging' : ''} ${dropTarget === site.id ? 'is-drop-target' : ''}`}
            draggable
            onDragStart={event => { setDraggedSite(site.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', site.id); }}
            onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (draggedSite && draggedSite !== site.id) setDropTarget(site.id); }}
            onDrop={event => { event.preventDefault(); moveSite(event.dataTransfer.getData('text/plain') || draggedSite || '', site.id); setDraggedSite(null); setDropTarget(null); }}
            onDragEnd={() => { setDraggedSite(null); setDropTarget(null); }}
          >
            <GripVertical aria-hidden="true" className="campus-launcher-drag-handle" size={13} />
            <Globe aria-hidden="true" className="campus-launcher-icon" size={16} strokeWidth={1.8} />
            <a className="campus-launcher-name" href={site.href} target="_blank" rel="noopener noreferrer" title={site.href}>{site.name}<ExternalLink aria-hidden="true" size={11} /></a>
            <button type="button" className="campus-launcher-remove" aria-label={`删除${site.name}`} onClick={() => setSites(current => current.filter(item => item.id !== site.id))}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      {sites.length === 0 && !isAdding && <p className="campus-launcher-empty">添加常用网站，快捷入口数据不会上传。</p>}
    </nav>
  );
};