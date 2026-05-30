use candle_core::DType;
use candle_core::Device;
use candle_core::Tensor;
use candle_nn::VarBuilder;
use candle_transformers::models::clip;
use candle_transformers::models::clip::vision_model::ClipVisionConfig;
use candle_transformers::models::clip::{ClipConfig, ClipModel};

use tokenizers::tokenizer::Tokenizer;

pub fn get_model() -> (ClipModel, Tokenizer) {
    let config = ClipConfig::vit_base_patch32();

    let paths = [
            "/Users/praem90/personal/video-search-ai/ClipFinder/engine/.models/clip-ViT-B-32/model.safetensors",
    ];

    let vb = unsafe {
        VarBuilder::from_mmaped_safetensors(&paths, DType::F32, &Device::Cpu)
            .unwrap_or_else(|e| panic!("Failed to load safetensors: {:?}", e))
    };
    let tokenizer = Tokenizer::from_file("/Users/praem90/personal/video-search-ai/ClipFinder/engine/.models/clip-vit-base-patch32/tokenizer.json").unwrap();

    return (ClipModel::new(vb, &config).unwrap(), tokenizer);
}

pub fn get_text_embedding(text: String) -> Result<Vec<f32>, String> {
    let (model, tokenizer) = get_model();
    let mut tokens = vec![];

    let encoding = tokenizer.encode(text, true).unwrap();

    tokens.push(encoding.get_ids().to_vec());
    let text_features = model
        .get_text_features(&Tensor::new(tokens, &Device::Cpu).unwrap())
        .unwrap();
    return Ok(clip::div_l2_norm(&text_features)
        .unwrap()
        .flatten_all()
        .unwrap()
        .to_vec1()
        .unwrap());
}

pub fn get_image_embedding(path: String) -> Result<Vec<f32>, String> {
    let (model, _) = get_model();
    let config = ClipVisionConfig::vit_base_patch32();
    let img = image::ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {:?}", e))?
        .decode()
        .unwrap()
        .resize_to_fill(
            config.image_size.try_into().unwrap(),
            config.image_size.try_into().unwrap(),
            image::imageops::FilterType::Triangle,
        )
        .to_rgb8()
        .into_raw();

    let img = Tensor::from_vec(
        img,
        &[config.image_size, config.image_size, 3],
        &Device::Cpu,
    )
    .unwrap()
    .permute((2, 0, 1))
    .unwrap()
    .to_dtype(DType::F32)
    .unwrap()
    .affine(2. / 255., -1.)
    .unwrap();

    let image_tensor = Tensor::stack(&[img], 0).unwrap();

    let image_features = model.get_image_features(&image_tensor).unwrap();

    return Ok(clip::div_l2_norm(&image_features)
        .unwrap()
        .flatten_all()
        .unwrap()
        .to_vec1()
        .unwrap());
}
