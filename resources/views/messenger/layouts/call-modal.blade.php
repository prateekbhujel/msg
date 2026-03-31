<div class="modal fade" id="callModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow-lg overflow-hidden" style="background: linear-gradient(180deg, #0f172a 0%, #111827 100%); color: #fff;">
            <div class="modal-header border-0 pb-0">
                <div>
                    <h5 class="modal-title call-title mb-1">Call</h5>
                    <p class="call-status text-white-50 mb-0">Waiting...</p>
                    <div class="call-duration small text-white-50 mt-1">00:00</div>
                </div>
                <button type="button" class="btn-close btn-close-white call-close" aria-label="Close"></button>
            </div>
            <div class="modal-body pt-2">
                <div class="call-stage position-relative rounded-4 overflow-hidden" style="min-height: 420px; background: radial-gradient(circle at top, rgba(59, 130, 246, 0.35), rgba(15, 23, 42, 1));">
                    <div class="call-placeholder position-absolute top-50 start-50 translate-middle text-center px-3">
                        <div class="call-participant-avatar rounded-circle border border-white border-3 shadow-lg mx-auto mb-3" style="width: 120px; height: 120px; background-size: cover; background-position: center center; background-image: url('{{ asset('default/avatar.png') }}');"></div>
                        <div class="call-participant-name fs-4 fw-semibold">Ready to connect</div>
                        <div class="call-media-label text-uppercase small text-white-50">Video call</div>
                    </div>
                    <video class="call-remote-video w-100 h-100 position-absolute top-0 start-0" autoplay playsinline style="object-fit: cover; background: #000;"></video>
                    <video class="call-local-video position-absolute bottom-0 end-0 m-3 rounded-4 border border-2 border-white shadow" autoplay playsinline muted style="width: 180px; height: 120px; object-fit: cover; transform: scaleX(-1);"></video>
                </div>

                <div class="incoming-call-actions d-flex gap-2 justify-content-end mt-3 d-none">
                    <button type="button" class="btn btn-success accept-call px-4">Accept</button>
                    <button type="button" class="btn btn-danger decline-call px-4">Decline</button>
                </div>
            </div>
            <div class="modal-footer border-0 pt-0">
                <button type="button" class="btn btn-danger hangup-call px-4">Hang up</button>
            </div>
        </div>
    </div>
</div>
