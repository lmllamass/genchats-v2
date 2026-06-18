import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { proyecto_id } = await req.json();
    if (!proyecto_id) return Response.json({ error: 'proyecto_id is required' }, { status: 400 });

    const proyecto = await base44.entities.Proyecto.get(proyecto_id);
    if (!proyecto?.html_generado) return Response.json({ error: 'No HTML to export' }, { status: 400 });

    const title = proyecto.nombre || 'Página generada';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pagina';
    const now = new Date();
    const pubDate = now.toUTCString();
    const wpDate = now.toISOString().replace('T', ' ').slice(0, 19);

    // Extract body content from full HTML – strip <html>, <head>, <body> wrappers
    let pageContent = proyecto.html_generado;
    const bodyMatch = pageContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      pageContent = bodyMatch[1];
    }

    // Extract inline styles from <head> to inject as a style block in the content
    let styleBlock = '';
    const styleMatch = proyecto.html_generado.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatch) {
      styleBlock = styleMatch.join('\n');
    }

    const contentWithStyles = styleBlock + '\n' + pageContent;

    // Build WordPress eXtended RSS (WXR) XML
    const wxr = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
  <title>PageGen AI Export</title>
  <link>https://pagegen.ai</link>
  <description>Exportación de PageGen AI</description>
  <language>es</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>https://pagegen.ai</wp:base_site_url>
  <wp:base_blog_url>https://pagegen.ai</wp:base_blog_url>

  <item>
    <title><![CDATA[${title}]]></title>
    <link>https://pagegen.ai/${slug}</link>
    <pubDate>${pubDate}</pubDate>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <description></description>
    <content:encoded><![CDATA[<!-- wp:html -->
${contentWithStyles}
<!-- /wp:html -->]]></content:encoded>
    <excerpt:encoded><![CDATA[${proyecto.metadata_scrapeado?.description || ''}]]></excerpt:encoded>
    <wp:post_id>1</wp:post_id>
    <wp:post_date>${wpDate}</wp:post_date>
    <wp:post_date_gmt>${wpDate}</wp:post_date_gmt>
    <wp:post_modified>${wpDate}</wp:post_modified>
    <wp:post_modified_gmt>${wpDate}</wp:post_modified_gmt>
    <wp:comment_status>closed</wp:comment_status>
    <wp:ping_status>closed</wp:ping_status>
    <wp:post_name><![CDATA[${slug}]]></wp:post_name>
    <wp:status>publish</wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>0</wp:menu_order>
    <wp:post_type>page</wp:post_type>
    <wp:post_password></wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
  </item>
</channel>
</rss>`;

    // Upload as XML file
    const encoder = new TextEncoder();
    const xmlBytes = encoder.encode(wxr);
    const file = new File([xmlBytes], `${slug}-wordpress.xml`, { type: 'application/xml' });

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    return Response.json({ xml_url: file_url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});