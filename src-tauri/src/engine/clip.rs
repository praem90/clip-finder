use candle_core::DType;
use candle_core::Device;
use candle_core::Tensor;
use candle_nn::VarBuilder;
use candle_transformers::models::clip;
use candle_transformers::models::clip::vision_model::ClipVisionConfig;
use candle_transformers::models::clip::{ClipConfig, ClipModel};

use hf_hub::api::sync::Api;
use hf_hub::Repo;
use hf_hub::RepoType;
use tokenizers::tokenizer::Tokenizer;

pub fn get_model() -> (ClipModel, Tokenizer) {
    let model_id = "sentence-transformers/clip-ViT-B-32";
    let repo = Repo::with_revision(model_id.to_string(), RepoType::Model, "main".to_string());
    let api = Api::new().unwrap();

    let repo = api.repo(repo);
    let path = repo.get("0_CLIPModel/model.safetensors").unwrap();

    let openai_repo = api.model("openai/clip-vit-base-patch32".to_string());
    let tokenizer_path = openai_repo.get("tokenizer.json").unwrap();

    let vb = unsafe {
        VarBuilder::from_mmaped_safetensors(&[&path], DType::F32, &Device::Cpu)
            .unwrap_or_else(|e| panic!("Failed to load safetensors: {:?}", e))
    };
    let tokenizer = Tokenizer::from_file(tokenizer_path).unwrap();

    let config = ClipConfig::vit_base_patch32();
    return (ClipModel::new(vb, &config).unwrap(), tokenizer);
}

pub fn get_text_embedding(
    model: &ClipModel,
    tokenizer: &Tokenizer,
    text: String,
) -> Result<Vec<f32>, String> {
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

pub fn get_image_embedding(model: &ClipModel, path: &str) -> Result<Vec<f32>, String> {
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
