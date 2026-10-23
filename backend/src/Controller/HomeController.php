<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Sends "/" to the catalogue instead of Symfony's welcome page.
 *
 * The built SPA lives at /app/, which only exists once the frontend has been built.
 * When it hasn't, say where the UI actually is rather than 404ing — which is exactly
 * the confusion this page exists to prevent.
 */
final class HomeController extends AbstractController
{
    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    #[Route('/', name: 'home', methods: ['GET'])]
    public function __invoke(): Response
    {
        if (is_file($this->projectDir.'/public/app/index.html')) {
            return new RedirectResponse('/app/');
        }

        return new Response(<<<'HTML'
            <!doctype html>
            <meta charset="utf-8">
            <title>LEGO Catalog</title>
            <style>
              body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                     margin: 0; display: grid; place-items: center; min-height: 100vh;
                     background: #f9fafb; color: #111827; }
              main { max-width: 34rem; padding: 2rem; }
              h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
              p { color: #6b7280; }
              code { background: #f3f4f6; padding: .15em .4em; border-radius: 4px; font-size: .9em; }
              a { color: #0284c7; }
            </style>
            <main>
              <h1>The catalogue isn't built yet</h1>
              <p>Either run the Vite dev server, which prints the port it settled on:</p>
              <p><code>cd frontend &amp;&amp; npm run dev</code></p>
              <p>or build it once and have Symfony serve it from here:</p>
              <p><code>cd frontend &amp;&amp; npm run build</code> → <a href="/app/">/app/</a></p>
              <p>The API is up either way: <a href="/api">/api</a></p>
            </main>
            HTML);
    }
}
