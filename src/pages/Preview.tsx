import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // useNavigate を追加
import * as yaml from 'js-yaml';
import ReactMarkdown from 'react-markdown';
import './Preview.css'; // スタイルシートのパスが正しいことを確認してください

import Header from '../components/Header'; // パスが正しいことを確認してください
import Footer from '../components/Footer'; // パスが正しいことを確認してください

// 型定義 (変更なし)
interface PostFrontmatter {
    title: string;
    date: string;
    summary?: string;
    author?: string;
    authorID?: number;
    tags?: string[];
    [key: string]: any;
}

interface ParsedContent {
    data: Partial<PostFrontmatter>;
    body: string;
}

interface SinglePost {
    frontmatter: Partial<PostFrontmatter>;
    content: string; // Markdown本文
    slug: string;
}

// フロントマター解析関数 (変更なし)
function parseFrontMatter(content: string): ParsedContent {
    const match = /^---\n([\s\S]+?)\n---/.exec(content);
    if (!match) return { data: {}, body: content };

    const yamlContent = match[1];
    const body = content.slice(match[0].length).trim();

    let data: Partial<PostFrontmatter> = {};
    try {
        const parsedYaml = yaml.load(yamlContent);
        if (typeof parsedYaml === 'object' && parsedYaml !== null) {
            data = parsedYaml as PostFrontmatter;
        } else {
            console.error('YAMLのパース結果に異常があります');
        }
    } catch (e) {
        console.error('YAMLパースエラー:', e);
    }
    return { data, body };
}

// --- MarkdownFileUploader 内部コンポーネント ---
interface MarkdownFileUploaderProps {
    onUploadSuccess: (slug: string, title?: string) => void;
}

const MarkdownFileUploader: React.FC<MarkdownFileUploaderProps> = ({ onUploadSuccess }) => {
    const [uploadMessage, setUploadMessage] = useState<string>('');
    const [isUploading, setIsUploading] = useState<boolean>(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!file.name.endsWith('.md')) {
            setUploadMessage('エラー: .md 形式のファイルを選択してください。');
            event.target.value = ''; // ファイル選択をリセット
            return;
        }

        setIsUploading(true);
        setUploadMessage('アップロード処理中...');

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const slug = file.name.replace(/\.md$/, ''); // ファイル名から拡張子を除去してslugに

            let title = slug; // デフォルトタイトルはslug
            try {
                // フロントマターからタイトルを試みとして取得
                const { data: fmData } = parseFrontMatter(content);
                if (fmData.title) {
                    title = fmData.title;
                }
            } catch (parseError) {
                console.warn("アップロード時のFrontmatterパースエラー（タイトル取得試行）:", parseError);
            }
            
            try {
                localStorage.setItem(`blogPost_${slug}`, content);
                setUploadMessage(`記事 '${title}' (slug: ${slug}) をブラウザアプリ内に保存しました。`);
                onUploadSuccess(slug, title);
            } catch (err: any) {
                const errorMessage = err.message || String(err);
                setUploadMessage(`保存に失敗しました: ${errorMessage}. ローカルストレージの容量制限の可能性があります。`);
                console.error("ローカルストレージ保存エラー:", err);
            } finally {
                setIsUploading(false);
            }
        };
        reader.onerror = () => {
            setUploadMessage('ファイルの読み取りに失敗しました。');
            setIsUploading(false);
        };
        reader.readAsText(file);
        event.target.value = ''; // 同じファイルを連続してアップロードできるようにリセット
    };

    return (
        <div className="markdown-uploader-container"> {/* CSSクラスは Preview.css で定義 */}
            <input 
                type="file" 
                id="mdFileUploader" 
                accept=".md" 
                onChange={handleFileUpload} 
                disabled={isUploading}
            />
            {isUploading && <p className="upload-status">アップロード中...</p>}
            {uploadMessage && (
                <p className={`upload-message ${uploadMessage.includes('エラー') || uploadMessage.includes('失敗') ? 'error' : 'success'}`}>
                    {uploadMessage}
                </p>
            )}
        </div>
    );
};

// --- Preview (メインコンポーネント) ---
const Preview: React.FC = () => {
    const { slug: currentSlugFromParams } = useParams<{ slug: string }>(); // URLから取得する現在のslug
    const navigate = useNavigate(); // ページ遷移用フック

    const [post, setPost] = useState<SinglePost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploaderKey, setUploaderKey] = useState(Date.now()); // アップローダーのメッセージをリセットするため

    // ローカルストレージから記事をフェッチする関数
    const fetchPostFromLocalStorage = useCallback((slugToFetch: string | undefined) => {
        if (!slugToFetch) {
            setPost(null);
            setError(null);
            setLoading(false); // slugがない場合はローディングも完了
            return;
        }

        setLoading(true);
        setError(null);
        setPost(null);

        // setTimeoutを使用して、状態更新が確実に行われた後にDOM操作や重い処理が走ることを模倣
        // (実際にはlocalStorageアクセスは同期的だが、UX向上のためや、将来的な非同期処理への布石)
        setTimeout(() => {
            try {
                const rawContent = localStorage.getItem(`blogPost_${slugToFetch}`);
                if (rawContent === null) {
                    setError(`記事 '${slugToFetch}' がローカルストレージに見つかりません。ファイルがアップロードされているか、slugが正しいか確認してください。`);
                    setLoading(false);
                    return;
                }
                const { data, body } = parseFrontMatter(rawContent);
                if (!data.title) {
                    console.warn(`記事 '${slugToFetch}' (slug: ${slugToFetch}) にタイトルがありません。`);
                }
                setPost({
                    frontmatter: data,
                    content: body,
                    slug: slugToFetch,
                });
            } catch (e: any) {
                console.error(`記事 '${slugToFetch}' のローカルストレージからの読み込みまたはパースに失敗しました:`, e);
                setError('記事の読み込み中に予期せぬエラーが発生しました。コンソールを確認してください。');
            } finally {
                setLoading(false);
            }
        }, 100); // わずかな遅延（任意）

    }, []); // useCallbackの依存配列は空

    // URLのslugが変更されたら記事を再フェッチ
    useEffect(() => {
        fetchPostFromLocalStorage(currentSlugFromParams);
    }, [currentSlugFromParams, fetchPostFromLocalStorage]);

    // アップロード成功時のコールバック
    const handleUploadSuccess = (uploadedSlug: string, uploadedTitle?: string) => {
        // アップロードされた記事のパスに遷移
        // (例: /preview/my-new-post) - あなたのルーティング設定に合わせてパスを調整してください
        const basePath = "/preview"; // もしルーティングのベースパスが異なる場合は調整
        navigate(`${basePath}/${uploadedSlug}`); 

        // アップローダーのメッセージをクリアするためにキーを更新 (任意)
        // setUploaderKey(Date.now()); 
        // navigateが発火するとcurrentSlugFromParamsが変わりuseEffectが動くので、
        // fetchPostFromLocalStorageが呼ばれ、記事が更新されるはず。
    };

    // 著者画像のパス取得 (変更なし)
    const getAuthorImagePath = (authorID?: number): string | null => {
        if (!authorID) return null;
        const imageName = 'user'+ authorID + '.jpg';
        return `/images/${imageName}`; // publicフォルダ等、アクセス可能なパス
    };
    
    const authorImagePath = post?.frontmatter.authorID ? getAuthorImagePath(post.frontmatter.authorID) : null;
    const authorName = post?.frontmatter.author;

    // Twitterシェア用情報 (postが存在する場合のみ生成)
    const siteBaseUrl = 'https://omoshirokaiwai.com/blog/'; // ご自身のサイトURLに
    const shareUrl = post ? `${siteBaseUrl}${post.slug}` : siteBaseUrl;
    const shareText = post?.frontmatter.title
        ? `${post.frontmatter.title}｜おもしろ界隈`
        : `記事を読みました｜おもしろ界隈`;
    const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

    return (
        <div className="preview-page-container"> {/* CSSクラスは Preview.css で定義 */}
            <Header />

            <div className="container"> {/* 全体を囲むコンテナ */}
                {/* Uploader Section */}
                <section className="uploader-main-section"> {/* CSSクラスは Preview.css で定義 */}
                    <h2>マークダウン記事アップローダー</h2>
                    <p>自分のパソコンから.mdファイルをアップロードしてプレビューできます。</p>
                    <MarkdownFileUploader key={uploaderKey} onUploadSuccess={handleUploadSuccess} />
                </section>

                {/* Post Display Section */}
                {currentSlugFromParams ? ( // URLにslugがある場合のみ記事表示を試みる
                    <main className="main-content">
                        {loading && (
                            <div className="loading-container-inline"> {/* CSSクラスは Preview.css で定義 */}
                                <p>記事「{currentSlugFromParams}」を読み込んでいます...</p>
                            </div>
                        )}
                        {error && !loading && (
                            <div className="error-container-inline"> {/* CSSクラスは Preview.css で定義 */}
                                <p className="error-message">{error}</p>
                                <Link to="/blogs" className="cta-button-secondary">ブログ一覧へ戻る</Link>
                            </div>
                        )}
                        {post && !loading && !error && (
                            <article className="blog-post-content-wrapper">
                                <header className="blog-post-main-header">
                                    <h1>{post.frontmatter.title || '無題の記事'}</h1>
                                    {post.frontmatter.date && (
                                        <p className="post-meta">
                                            公開日: <time dateTime={post.frontmatter.date}>{new Date(post.frontmatter.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                                        </p>
                                    )}
                                    {authorName && (
                                        <p className="post-meta author-info">
                                            {authorImagePath  ? (
                                                <img
                                                    src={authorImagePath}
                                                    alt={`${authorName}のアイコン`}
                                                    className="author-icon"
                                                    onError={(e) => { // 元のonError処理
                                                        console.warn(`著者の画像が見つかりませんでした: ${authorImagePath}`);
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        const nextSibling = (e.target as HTMLImageElement).nextElementSibling;
                                                        if (nextSibling && nextSibling.classList.contains('default-author-icon')) { // default-author-icon があるか確認
                                                            (nextSibling as HTMLElement).style.display = 'inline-block';
                                                        }
                                                    }}
                                                />
                                            ) : null}
                                            {/* 画像がない、またはエラー時のフォールバックアイコン */}
                                            {(!authorImagePath || (authorImagePath && document.querySelector(`img[src="${authorImagePath}"]`)?.style.display === 'none')) && (
                                                <span className="author-icon default-author-icon"></span>
                                            )}
                                            {authorName}
                                        </p>
                                    )}
                                    {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
                                        <div className="post-tags">
                                            {post.frontmatter.tags.map(tag => (
                                                <span key={tag} className="tag">#{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </header>
                                <div className="blog-post-body">
                                    <ReactMarkdown components={{ /* カスタムコンポーネント */ }}>
                                        {post.content}
                                    </ReactMarkdown>
                                </div>
                                <div className='x-share-links'>
                                    <a
                                        href={twitterShareUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="cta-button-secondary twitter-share-button"
                                    >
                                        <img 
                                            className="x-share-button"
                                            src='/images/x-twitter-brands.svg' // パス確認
                                            alt="Xで共有する"
                                        />
                                        共有する
                                    </a>
                                </div>
                            </article>
                        )}
                         {/* slugはあるが、postもerrorもない場合（通常はloading中）*/}
                        {!post && !loading && !error && currentSlugFromParams && (
                             <div className="info-container">
                                <p>記事 '{currentSlugFromParams}' のデータがありません。アップロードされているか確認してください。</p>
                             </div>
                        )}
                        <div className="navigation-links">
                            <Link to="/" className="cta-button-secondary">&larr; 他の記事を見る</Link>
                        </div>
                    </main>
                ) : ( // URLにslugがない場合 (例: /preview/ でアクセス時)
                    <main className="main-content">
                        <div className="container instructions-container"> {/* CSSクラスは Preview.css で定義 */}
                            <p>記事をプレビューするには、URLで記事のslugを指定するか (例: <code>/preview/your-article-slug</code>)、上記フォームから新しい記事をアップロードしてください。</p>
                        </div>
                    </main>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default Preview;