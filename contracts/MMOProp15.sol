// SPDX-License-Identifier: MIT

// contract by steviep.eth

import "./Dependencies.sol";

pragma solidity ^0.8.17;

interface IMMO {
  function votes(uint256 tokenId, uint256 proposal) external view returns (bool);
  function ownerOf(uint256 tokenId) external view returns (address);
}

contract MMOProp15 {
  IMMO public constant mmo = IMMO(0x41d3d86a84c8507A7Bc14F2491ec4d188FA944E7);
  MMOProp15WhitePaper public whitePaper;

  mapping(uint256 => bool) public redeemed;

  constructor() {
    whitePaper = new MMOProp15WhitePaper();
  }

  receive() external payable {}

  function withdraw(uint256 tokenId) external {

    require(redeemed[tokenId] == false, 'MMO token has already been redeemed');
    require(mmo.votes(tokenId, 15) == true, 'MMO token did not vote yay for Prop15');
    require(mmo.ownerOf(tokenId) == msg.sender, 'Signer does not own MMO token');


    uint256 amount = tokenId == 1459
      ? 14.025481 ether
      : 0.0435 ether;

    redeemed[tokenId] = true;
    payable(msg.sender).transfer(amount);
  }

  function updateWhitePaper(address newWhitePaperAddr) external {
    require(msg.sender == mmo.ownerOf(0), 'Cannot update');
    whitePaper = MMOProp15WhitePaper(newWhitePaperAddr);
  }
}



contract MMOProp15WhitePaper is ERC721 {
  uint256 public totalSupply;
  Prop15WpTokenURI public tokenURIContract;
  IMMO public constant mmo = IMMO(0x41d3d86a84c8507A7Bc14F2491ec4d188FA944E7);

  mapping(uint256 => bool) public mmoTokenUsed;

  constructor() ERC721('MMO Proposal 15 White Paper', 'MMO15') {
    tokenURIContract = new Prop15WpTokenURI();
    mmoTokenUsed[1459] = true;
    _mint(mmo.ownerOf(1459), totalSupply);
    totalSupply++;
  }

  function mint(uint256 mmoTokenId) public {
    require(mmoTokenUsed[mmoTokenId] == false, 'MMO token has already been used');
    require(mmo.votes(mmoTokenId, 15) == true, 'MMO token did not vote yay for Prop15');
    require(mmo.ownerOf(mmoTokenId) == msg.sender, 'Signer does not own MMO token');

    mmoTokenUsed[mmoTokenId] = true;

    _mint(msg.sender, totalSupply);
    totalSupply++;
  }

  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return Prop15WpTokenURI(tokenURIContract).tokenURI(tokenId);
  }

  function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
  }

  function setURIContract(address _uriContract) external {
    require(msg.sender == mmo.ownerOf(0), 'Cannot update');
    tokenURIContract = Prop15WpTokenURI(_uriContract);
  }
}

contract Prop15WpTokenURI {
  string public constant encodedSVG = 'PHN2ZyB2aWV3Qm94PSIwIDAgODUwIDExMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHN0eWxlPnRleHR7Zm9udDpib2xkIDUwcHggc2Fucy1zZXJpZjtmaWxsOiMwMDA7dGV4dC1hbmNob3I6IG1pZGRsZX08L3N0eWxlPjxyZWN0IHdpZHRoPSI4NTAiIGhlaWdodD0iMTEwMCIgeD0iMCIgeT0iMCIgZmlsbD0iI2ZmZiIgc3Ryb2tlPSJub25lIj48L3JlY3Q+PHJlY3QgeD0iMTUwIiB5PSIxNTAiIHdpZHRoPSI1NTAiIGhlaWdodD0iODAwIiBzdHlsZT0iZmlsbDpub25lO3N0cm9rZTojMDAwO3N0cm9rZS13aWR0aDo3LjVweCI+PC9yZWN0Pjx0ZXh0IHg9IjQyNSIgeT0iMzI1Ij5QUk9QIDE1PC90ZXh0Pjx0ZXh0IHg9IjQyNSIgeT0iNTUwIj5XSElURTwvdGV4dD48dGV4dCB4PSI0MjUiIHk9Ijc3NSI+UEFQRVI8L3RleHQ+PC9zdmc+';

  IMMO public constant mmo = IMMO(0x41d3d86a84c8507A7Bc14F2491ec4d188FA944E7);
  string public fullWhitePaper = 'ipfs://bafybeib3vuf5vuheloz2sgjtxt33yj42qesu7fjvqz4pstdxxhylu7zzi4/index.html';

  function tokenURI(uint256) public view  returns (string memory) {
    bytes memory encodedImage = abi.encodePacked('"image": "data:image/svg+xml;base64,', encodedSVG, '",');

    bytes memory json = abi.encodePacked(
      'data:application/json;utf8,',
      '{"name": "MMO Proposal 15 White Paper",',
      '"symbol": "MMO15",',
      '"description": "The White Paper for Money Making Opportunity Proposal #15",',
      encodedImage,
      '"license": "CC0",'
      '"animation_url": "', fullWhitePaper,'",',
      '"external_url": "https://steviep.xyz/moneymakingopportunity/15"',
      '}'
    );
    return string(json);
  }

  function updateWhitePaperURI(string memory newURI) external {
    require(msg.sender == mmo.ownerOf(0), 'Cannot update');
    fullWhitePaper = newURI;
  }
}