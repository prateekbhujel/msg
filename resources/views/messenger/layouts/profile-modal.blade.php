<div class="modal fade" id="exampleModal" tabindex="-1" aria-labelledby="exampleModalLabel"
aria-hidden="true">
<div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
        <div class="modal-body">
            <form action="#" class="profile-form">
                @csrf

                <div class="file profile-file">
                    <img src="{{ asset(auth()->user()->avatar) }}" alt="Upload" class="img-fluid profile-image-preview">
                    <label for="select_file"><i class="fal fa-camera-alt"></i></label>
                    <input id="select_file" type="file" hidden>
                </div>
                <p>Edit information</p>
                <input type="text" name="name" placeholder="Name" value="{{ old('name', auth()->user()->name) }}">
                <input type="text" name="user_id" placeholder="User Id" value="{{ old('user_id', auth()->user()->user_id) }}">
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
                let formData = $(this).serialize();

                $.ajax({
                    method: 'POST',
                    url: '{{ route("profile.update") }}',
                    data: formData,
                    success: function(data){

                    },
                    error: function(xhr, status, error){
                        console.log(xhr);
                        let errors = xhr.responseJSON.errors;

                        $.each(errors, function(index, value) {
                            notyf.error(value[0]);
                        });
                    }
                });

            });
        });


    </script>
@endpush