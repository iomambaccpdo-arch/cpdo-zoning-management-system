<?php

namespace App\Http\Middleware;

use App\Support\PhpIniSize;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRequestWithinPostLimits
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)) {
            return $next($request);
        }

        $contentLength = (int) $request->server('CONTENT_LENGTH', 0);

        if ($contentLength <= 0) {
            return $next($request);
        }

        $postMaxBytes = PhpIniSize::toBytes((string) ini_get('post_max_size'));

        if ($contentLength <= $postMaxBytes) {
            return $next($request);
        }

        return response()->json([
            'message' => 'The request is too large (PDF uploads exceed PHP post_max_size). Use fewer or smaller PDFs, or increase post_max_size — see TURNOVER.md §15.',
            'limit_bytes' => $postMaxBytes,
            'received_bytes' => $contentLength,
        ], 413);
    }
}
