@extends('messenger.layouts.app')
@section('contents')

    <section class="wsus__chat_app show_info">

        @include('messenger.layouts.user-list-sidebar')

        <div class="wsus__chat_area">

            <div class="wsus__message_paceholder d-none"></div> 
            <div class="wsus__message_paceholder_blank d-flex justify-content-center align-items-center">
                <span class="select_a_user text-muted fst-italic fs-5">Please, Select an User to Start an Conversation 🙂 !</span>
            </div> 

            <div class="wsus__chat_area_header">
                <div class="header_left messenger-header">
                    <span class="back_to_list">
                        <i class="fas fa-arrow-left"></i>
                    </span>
                    <img src="" alt="User-Image" class="img-fluid">
                    <h4></h4>
                </div>
                <div class="header_right">
                    <a href="javascript:void(0)" class="favourite"><i class="fas fa-star"></i></a>
                    <a href="javascript:void(0)" class="call-action start-call" data-call-type="audio" title="Audio call"><i class="fas fa-phone"></i></a>
                    <a href="javascript:void(0)" class="call-action start-call" data-call-type="video" title="Video call"><i class="fas fa-video"></i></a>
                    <a href="javascript:void(0)" class="info"><i class="fas fa-info-circle"></i></a>
                </div>
            </div>
 
            <div class="wsus__chat_area_body">

            </div>

            <div class="wsus__chat_area_footer">
                <div class="footer_message">
                    <div class="attachment-block d-none">
                        <div class="attachment-preview-header">
                            <div class="attachment-preview-copy">
                                <span class="attachment-preview-label">Attachments ready</span>
                                <span class="attachment-preview-hint">Tap X to clear</span>
                            </div>
                            <button type="button" class="cancel-attachment" aria-label="Remove attachments">
                                <i class="far fa-times"></i>
                            </button>
                        </div>
                        <div class="attachment-preview-list"></div>
                    </div>
                    <form class="message-form" enctype="multipart/form-data">
                        <div class="composer-actions">
                            <div class="file">
                                <label for="file"><i class="far fa-plus"></i></label>
                                <input id="file" class="attachment-input" name="attachments[]" type="file" hidden multiple accept="image/*,audio/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip,.rar">
                            </div>
                            <div class="composer-voice-control">
                                <button type="button" class="voice-record-toggle" title="Record voice note" aria-pressed="false">
                                    <i class="fas fa-microphone"></i>
                                </button>
                                <span class="voice-record-status d-none small text-danger ms-2"></span>
                            </div>
                        </div>
                        <textarea class="message-input" id="example1" rows="1" placeholder="Type a message.." name="message"></textarea>
                        <button type="submit"><i class="fas fa-paper-plane"></i></button>
                    </form>
                    <div class="voice-preview d-none"></div>
                </div>
            </div>
        </div>

        @include('messenger.layouts.user-info-sidebar')

    </section>

    @include('messenger.layouts.call-modal')

@endsection
