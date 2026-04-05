<!DOCTYPE html>
<html lang="en">

<head>
    @php
        $versionedAsset = function (string $path): string {
            $absolutePath = public_path($path);
            $version = is_file($absolutePath) ? filemtime($absolutePath) : null;

            return asset($path) . ($version ? '?v=' . $version : '');
        };
    @endphp
    <meta charset="UTF-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, target-densityDpi=device-dpi" />
        <meta name="id" content="">
        <meta name="conversation-key" content="">
        <meta name="csrf_token" content="{{ csrf_token() }}">
        <meta name="auth_id" content="{{ auth()->user()->id }}">
        <meta name="asset-url" content="{{ asset('') }}">
        <meta name="webrtc-ice-servers" content='@json(config("services.webrtc.ice_servers"))'>
        <meta name="theme-color" content="#2180f3">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <meta name="apple-mobile-web-app-title" content="{{ config('app.name') }}">
        <meta name="description" content="Real-time chat, voice notes, calls, groups, and shared media in one installable messenger.">

        
        <title>{{ config('app.name') }}</title>
    <link rel="icon" type="image/png" href="{{ $versionedAsset('assets/images/icon.png') }}">
    <link rel="manifest" href="{{ $versionedAsset('manifest.webmanifest') }}">
    <link rel="apple-touch-icon" href="{{ $versionedAsset('pwa/icon-192.png') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/all.min.css') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/slick.css') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/venobox.min.css') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/emojionearea.min.css') }}">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.css">
    <link rel="stylesheet" href="https://unpkg.com/nprogress@0.2.0/nprogress.css">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/spacing.css') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/style.css') }}">
    <link rel="stylesheet" href="{{ $versionedAsset('assets/css/responsive.css') }}">
    @routes
    {{-- Scripts Vite --}}
    @vite(['resources/js/bootstrap.js', 'resources/js/messenger.js'])
</head>

<body>

    <!--==================================
        Chatting Application Start
    ===================================-->
        @yield('contents')
    <!--==================================
        Chatting Application End
    ===================================-->


    <!--jquery library js-->
    <script src="{{ $versionedAsset('assets/js/jquery-3.7.1.min.js') }}"></script>
    <!--bootstrap js-->
    <script src="{{ $versionedAsset('assets/js/bootstrap.bundle.min.js') }}"></script>
    <!--font-awesome js-->
    <script src="{{ $versionedAsset('assets/js/Font-Awesome.js') }}"></script>
    <script src="{{ $versionedAsset('assets/js/slick.min.js') }}"></script>
    <script src="{{ $versionedAsset('assets/js/venobox.min.js') }}"></script>
    <script src="{{ $versionedAsset('assets/js/emojionearea.min.js') }}"></script>
    <script src="https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.js"></script>
    <script src="https://unpkg.com/nprogress@0.2.0/nprogress.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <!--main/custom js-->
    <script src="{{ $versionedAsset('assets/js/main.js') }}"></script>
    <script>
        const notyf = new Notyf({
                duration: 5000,
            },

        );
    </script>
    @stack('scripts')
</body>

</html>
