/**
 * External dependencies
 */
import { every, get, isArray, noop, startsWith } from 'lodash';
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import {
	Button,
	FormFileUpload,
	Placeholder,
	DropZone,
	withFilters,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { Component } from '@wordpress/element';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import deprecated from '@wordpress/deprecated';
import { keyboardReturn } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import MediaUpload from '../media-upload';
import MediaUploadCheck from '../media-upload/check';
import URLPopover from '../url-popover';

const InsertFromURLPopover = ( { src, onChange, onSubmit, onClose } ) => (
	<URLPopover onClose={ onClose }>
		<form
			className="block-editor-media-placeholder__url-input-form"
			onSubmit={ onSubmit }
		>
			<input
				className="block-editor-media-placeholder__url-input-field"
				type="url"
				aria-label={ __( 'URL' ) }
				placeholder={ __( 'Paste or type URL' ) }
				onChange={ onChange }
				value={ src }
			/>
			<Button
				className="block-editor-media-placeholder__url-input-submit-button"
				icon={ keyboardReturn }
				label={ __( 'Apply' ) }
				type="submit"
			/>
		</form>
	</URLPopover>
);

export class MediaPlaceholder extends Component {
	constructor() {
		super( ...arguments );
		this.state = {
			src: '',
			isURLInputVisible: false,
		};
		this.onChangeSrc = this.onChangeSrc.bind( this );
		this.onSubmitSrc = this.onSubmitSrc.bind( this );
		this.onUpload = this.onUpload.bind( this );
		this.onFilesUpload = this.onFilesUpload.bind( this );
		this.openURLInput = this.openURLInput.bind( this );
		this.closeURLInput = this.closeURLInput.bind( this );
	}

	onlyAllowsImages() {
		const { allowedTypes } = this.props;
		if ( ! allowedTypes ) {
			return false;
		}
		return every( allowedTypes, ( allowedType ) => {
			return (
				allowedType === 'image' || startsWith( allowedType, 'image/' )
			);
		} );
	}

	componentDidMount() {
		this.setState( { src: get( this.props.value, [ 'src' ], '' ) } );
	}

	componentDidUpdate( prevProps ) {
		if (
			get( prevProps.value, [ 'src' ], '' ) !==
			get( this.props.value, [ 'src' ], '' )
		) {
			this.setState( { src: get( this.props.value, [ 'src' ], '' ) } );
		}
	}

	onChangeSrc( event ) {
		this.setState( { src: event.target.value } );
	}

	onSubmitSrc( event ) {
		event.preventDefault();
		if ( this.state.src && this.props.onSelectURL ) {
			this.props.onSelectURL( this.state.src );
			this.closeURLInput();
		}
	}

	onUpload( event ) {
		this.onFilesUpload( event.target.files );
	}

	onFilesUpload( files ) {
		const {
			addToGallery,
			allowedTypes,
			mediaUpload,
			multiple,
			onError,
			onSelect,
		} = this.props;
		let setMedia;
		if ( multiple ) {
			if ( addToGallery ) {
				// To allow changes to a gallery to be made while uploads are in progress
				// (including trigging multiple upload groups and removing already in place images),
				// we must be able to add newMedia based on the current value of the Gallery
				// whenever the setMedia function runs. Since the setMedia function runs multiple
				// times per upload group and is passed newMedia containing every item in its
				// group each time, we must also filter out whatever this upload group had
				// previously returned to the gallery before adding and returning the image
				// array with replacement newMedia values.

				// Define an array to store urls from newMedia between subsequent function calls.
				let lastMediaPassed = [];
				setMedia = ( newMedia ) => {
					// Get the current array of images on the Gallery.
					const currentMedia = this.props.value || [];
					// Remove any images this upload group is responsible for (lastMediaPassed).
					// Their replacements are contained in newMedia.
					const filteredMedia = currentMedia.filter( ( item ) => {
						// If Item has id, only remove it if lastMediaPassed has an item with that id.
						if ( item.id ) {
							return ! lastMediaPassed.some( ( { id } ) => id === item.id );
						}
						// Compare transient images via .includes since gallery may append extra info onto the url.
						return ! lastMediaPassed.some( ( { urlSlug } ) => item.url.includes( urlSlug ) );
					} );
					// Return the filtered media array along with newMedia.
					onSelect( filteredMedia.concat( newMedia ) );
					// Reset lastMediaPassed and set it with ids and urls from newMedia.
					lastMediaPassed = newMedia.map( ( media ) => {
						// Add everything up to '.fileType' to compare via .includes.
						const cutOffIndex = media.url.lastIndexOf( '.' );
						const urlSlug = media.url.slice( 0, cutOffIndex );
						return { id: media.id, urlSlug };
					} );
				};
			} else {
				setMedia = onSelect;
			}
		} else {
			setMedia = ( [ media ] ) => onSelect( media );
		}
		mediaUpload( {
			allowedTypes,
			filesList: files,
			onFileChange: setMedia,
			onError,
		} );
	}

	openURLInput() {
		this.setState( { isURLInputVisible: true } );
	}

	closeURLInput() {
		this.setState( { isURLInputVisible: false } );
	}

	renderPlaceholder( content, onClick ) {
		const {
			allowedTypes = [],
			className,
			icon,
			isAppender,
			labels = {},
			onDoubleClick,
			mediaPreview,
			notices,
			onSelectURL,
			mediaUpload,
			children,
		} = this.props;

		let instructions = labels.instructions;
		let title = labels.title;

		if ( ! mediaUpload && ! onSelectURL ) {
			instructions = __(
				'To edit this block, you need permission to upload media.'
			);
		}

		if ( instructions === undefined || title === undefined ) {
			const isOneType = 1 === allowedTypes.length;
			const isAudio = isOneType && 'audio' === allowedTypes[ 0 ];
			const isImage = isOneType && 'image' === allowedTypes[ 0 ];
			const isVideo = isOneType && 'video' === allowedTypes[ 0 ];

			if ( instructions === undefined && mediaUpload ) {
				instructions = __(
					'Upload a media file or pick one from your media library.'
				);

				if ( isAudio ) {
					instructions = __(
						'Upload an audio file, pick one from your media library, or add one with a URL.'
					);
				} else if ( isImage ) {
					instructions = __(
						'Upload an image file, pick one from your media library, or add one with a URL.'
					);
				} else if ( isVideo ) {
					instructions = __(
						'Upload a video file, pick one from your media library, or add one with a URL.'
					);
				}
			}

			if ( title === undefined ) {
				title = __( 'Media' );

				if ( isAudio ) {
					title = __( 'Audio' );
				} else if ( isImage ) {
					title = __( 'Image' );
				} else if ( isVideo ) {
					title = __( 'Video' );
				}
			}
		}

		const placeholderClassName = classnames(
			'block-editor-media-placeholder',
			className,
			{
				'is-appender': isAppender,
			}
		);

		return (
			<Placeholder
				icon={ icon }
				label={ title }
				instructions={ instructions }
				className={ placeholderClassName }
				notices={ notices }
				onClick={ onClick }
				onDoubleClick={ onDoubleClick }
				preview={ mediaPreview }
			>
				{ content }
				{ children }
			</Placeholder>
		);
	}

	renderDropZone() {
		const { disableDropZone, onHTMLDrop = noop } = this.props;

		if ( disableDropZone ) {
			return null;
		}

		return (
			<DropZone
				onFilesDrop={ this.onFilesUpload }
				onHTMLDrop={ onHTMLDrop }
			/>
		);
	}

	renderCancelLink() {
		const { onCancel } = this.props;
		return (
			onCancel && (
				<Button
					className="block-editor-media-placeholder__cancel-button"
					title={ __( 'Cancel' ) }
					isLink
					onClick={ onCancel }
				>
					{ __( 'Cancel' ) }
				</Button>
			)
		);
	}

	renderUrlSelectionUI() {
		const { onSelectURL } = this.props;
		if ( ! onSelectURL ) {
			return null;
		}
		const { isURLInputVisible, src } = this.state;
		return (
			<div className="block-editor-media-placeholder__url-input-container">
				<Button
					className="block-editor-media-placeholder__button"
					onClick={ this.openURLInput }
					isPressed={ isURLInputVisible }
					isTertiary
				>
					{ __( 'Insert from URL' ) }
				</Button>
				{ isURLInputVisible && (
					<InsertFromURLPopover
						src={ src }
						onChange={ this.onChangeSrc }
						onSubmit={ this.onSubmitSrc }
						onClose={ this.closeURLInput }
					/>
				) }
			</div>
		);
	}

	renderMediaUploadChecked() {
		const {
			accept,
			addToGallery,
			allowedTypes = [],
			isAppender,
			mediaUpload,
			multiple = false,
			onSelect,
			value = {},
		} = this.props;

		const mediaLibraryButton = (
			<MediaUpload
				addToGallery={ addToGallery }
				gallery={ multiple && this.onlyAllowsImages() }
				multiple={ multiple }
				onSelect={ onSelect }
				allowedTypes={ allowedTypes }
				value={
					isArray( value ) ? value.map( ( { id } ) => id ) : value.id
				}
				render={ ( { open } ) => {
					return (
						<Button
							isTertiary
							onClick={ ( event ) => {
								event.stopPropagation();
								open();
							} }
						>
							{ __( 'Media Library' ) }
						</Button>
					);
				} }
			/>
		);

		if ( mediaUpload && isAppender ) {
			return (
				<>
					{ this.renderDropZone() }
					<FormFileUpload
						onChange={ this.onUpload }
						accept={ accept }
						multiple={ multiple }
						render={ ( { openFileDialog } ) => {
							const content = (
								<>
									<Button
										isPrimary
										className={ classnames(
											'block-editor-media-placeholder__button',
											'block-editor-media-placeholder__upload-button'
										) }
									>
										{ __( 'Upload' ) }
									</Button>
									{ mediaLibraryButton }
									{ this.renderUrlSelectionUI() }
									{ this.renderCancelLink() }
								</>
							);
							return this.renderPlaceholder(
								content,
								openFileDialog
							);
						} }
					/>
				</>
			);
		}

		if ( mediaUpload ) {
			const content = (
				<>
					{ this.renderDropZone() }
					<FormFileUpload
						isPrimary
						className={ classnames(
							'block-editor-media-placeholder__button',
							'block-editor-media-placeholder__upload-button'
						) }
						onChange={ this.onUpload }
						accept={ accept }
						multiple={ multiple }
					>
						{ __( 'Upload' ) }
					</FormFileUpload>
					{ mediaLibraryButton }
					{ this.renderUrlSelectionUI() }
					{ this.renderCancelLink() }
				</>
			);
			return this.renderPlaceholder( content );
		}

		return this.renderPlaceholder( mediaLibraryButton );
	}

	render() {
		const { disableMediaButtons, dropZoneUIOnly } = this.props;

		if ( dropZoneUIOnly || disableMediaButtons ) {
			if ( dropZoneUIOnly ) {
				deprecated(
					'wp.blockEditor.MediaPlaceholder dropZoneUIOnly prop',
					{
						alternative: 'disableMediaButtons',
					}
				);
			}

			return (
				<MediaUploadCheck>{ this.renderDropZone() }</MediaUploadCheck>
			);
		}

		return (
			<MediaUploadCheck
				fallback={ this.renderPlaceholder(
					this.renderUrlSelectionUI()
				) }
			>
				{ this.renderMediaUploadChecked() }
			</MediaUploadCheck>
		);
	}
}

const applyWithSelect = withSelect( ( select ) => {
	const { getSettings } = select( 'core/block-editor' );

	return {
		mediaUpload: getSettings().mediaUpload,
	};
} );

/**
 * @see https://github.com/WordPress/gutenberg/blob/master/packages/block-editor/src/components/media-placeholder/README.md
 */
export default compose(
	applyWithSelect,
	withFilters( 'editor.MediaPlaceholder' )
)( MediaPlaceholder );
