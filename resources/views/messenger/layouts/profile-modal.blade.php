<div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel"
aria-hidden="true">
<div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
        <div class="modal-body">
            <form class="profile-form" enctype="multipart/form-data" autocomplete="off">
                @csrf

                <div class="file profile-file">
                    <img src="{{ asset(auth()->user()->avatar) }}" alt="Upload" class="img-fluid profile-image-preview">
                    <label for="select_file"><i class="fal fa-camera-alt"></i></label>
                    <input id="select_file" type="file" hidden name="avatar">
                </div>
                <p>Edit information</p>
                <input type="text" name="name" placeholder="Name" value="{{ old('name', auth()->user()->name) }}">
                <input type="text" name="user_id" placeholder="User Id" value="{{ old('user_id', auth()->user()->user_name) }}">
                <input type="email" name="email" placeholder="Email" value="{{ old('email', auth()->user()->email) }}">
                <p>Change password</p>
                <div class="row">
                    <div class="col-xl-6">
                        <input type="password" name="current_password"placeholder="Current Password">
                    </div>
                    <div class="col-xl-6">
                        <input type="password" name="password" placeholder="New Password">
                    </div>
                    <div class="col-xl-12">
                        <input type="password" name="password_confirmation" placeholder="Confirm Password">
                    </div>
                </div>
                <div class="modal-footer p-0 mt-4">
                    <button type="button" class="btn btn-secondary cancel"
                        data-bs-dismiss="modal">Close</button>
                    <button type="submit" class="btn btn-primary save">Update</button>
                </div>
            </form>
        </div>
    </div>
</div>
</div>

@push('scripts')
    <script>

        $(document).ready(function(){
            $('.profile-form').on('submit', function(e){
                e.preventDefault();
                let formData = new FormData(this);
                let saveBtn = $('.save');

                $.ajax({
                    method: 'POST',
                    url: '{{ route("profile.update") }}',
                    data: formData,
                    processData: false,
                    contentType: false,
                    beforeSend: function(){
                        saveBtn.html(`Updating....  <i class="ml-4 fas fa-spinner fa-spin"></i>`);
                        saveBtn.prop('disabled', true);
                    },
                    success: function(data){
                        window.location.reload();
                    },
                    error: function(xhr, status, error){
                        // console.log(xhr);
                        let errors = xhr.responseJSON.errors;

                        $.each(errors, function(index, value) {
                            notyf.error(value[0]);
                        });

                        saveBtn.text('Update');
                        saveBtn.prop('disabled', false);


                    }
                });

            });
        });


    </script>
@endpush